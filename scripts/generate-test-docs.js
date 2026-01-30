const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

/**
 * Generate Test Documentation
 * Automatically creates a markdown document from test results
 */
class TestDocGenerator {
  constructor() {
    this.outputPath = path.join(__dirname, "../docs/TEST_RESULTS.md");
    this.docsDir = path.join(__dirname, "../docs");
  }

  /**
   * Run tests and capture output
   */
  runTests() {
    console.log("Running test suite...\n");

    try {
      const output = execSync("npm test -- --json", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });

      return JSON.parse(output);
    } catch (error) {
      // Tests may fail but we still want the results
      if (error.stdout) {
        try {
          return JSON.parse(error.stdout);
        } catch (parseError) {
          console.error("Failed to parse test output");
          return null;
        }
      }
      return null;
    }
  }

  /**
   * Generate markdown documentation
   */
  generateMarkdown(testResults) {
    const timestamp = new Date().toISOString();

    let markdown = `# Test Results Documentation\n\n`;
    markdown += `**Generated:** ${timestamp}\n\n`;
    markdown += `---\n\n`;

    // Summary
    markdown += `## 📊 Summary\n\n`;
    markdown += `| Metric | Value |\n`;
    markdown += `|--------|-------|\n`;
    markdown += `| Total Tests | ${testResults.numTotalTests || 0} |\n`;
    markdown += `| Passed | ${testResults.numPassedTests || 0} |\n`;
    markdown += `| Failed | ${testResults.numFailedTests || 0} |\n`;
    markdown += `| Pending | ${testResults.numPendingTests || 0} |\n`;
    markdown += `| Success Rate | ${this.calculateSuccessRate(testResults)}% |\n`;
    markdown += `| Duration | ${this.formatDuration(testResults.testDuration || 0)} |\n\n`;

    // Test Suites
    markdown += `## 🧪 Test Suites\n\n`;

    if (testResults.testResults) {
      const groupedTests = this.groupTestsByType(testResults.testResults);

      markdown += `### Unit Tests\n\n`;
      markdown += this.formatTestGroup(groupedTests.unit);

      markdown += `### Integration Tests\n\n`;
      markdown += this.formatTestGroup(groupedTests.integration);

      markdown += `### System Tests\n\n`;
      markdown += this.formatTestGroup(groupedTests.system);
    }

    // Coverage
    if (testResults.coverage) {
      markdown += `## 📈 Coverage\n\n`;
      markdown += this.formatCoverage(testResults.coverage);
    }

    // Test Categories
    markdown += `## 📁 Test Categories\n\n`;
    markdown += `- **Unit Tests**: Test individual components in isolation\n`;
    markdown += `- **Integration Tests**: Test API endpoints and middleware integration\n`;
    markdown += `- **System Tests**: Test complete workflows end-to-end\n\n`;

    // Areas Covered
    markdown += `## ✅ Areas Covered\n\n`;
    markdown += `- User Authentication & Authorization\n`;
    markdown += `- Feature Toggle Management\n`;
    markdown += `- Rate Guard (API Rate Limiting)\n`;
    markdown += `- Audit Logging\n`;
    markdown += `- User Management\n`;
    markdown += `- Model Validation\n`;
    markdown += `- Middleware Enforcement\n`;
    markdown += `- Error Handling\n\n`;

    markdown += `---\n\n`;
    markdown += `*This document is automatically generated from test execution results.*\n`;

    return markdown;
  }

  /**
   * Group tests by type
   */
  groupTestsByType(testResults) {
    return {
      unit: testResults.filter((t) => t.name.includes("/unit/")),
      integration: testResults.filter((t) => t.name.includes("/integration/")),
      system: testResults.filter((t) => t.name.includes("/system/")),
    };
  }

  /**
   * Format test group
   */
  formatTestGroup(tests) {
    if (!tests || tests.length === 0) {
      return `*No tests in this category*\n\n`;
    }

    let output = "";
    tests.forEach((test) => {
      const fileName = path.basename(test.name);
      const status = test.status === "passed" ? "✅" : "❌";
      const testCount = test.numPassingTests || 0;
      const totalTests =
        (test.numPassingTests || 0) + (test.numFailingTests || 0);

      output += `**${status} ${fileName}**\n`;
      output += `- Tests: ${testCount}/${totalTests} passed\n`;
      output += `- Duration: ${this.formatDuration(test.perfStats?.runtime || 0)}\n\n`;
    });

    return output;
  }

  /**
   * Format coverage information
   */
  formatCoverage(coverage) {
    let output = "| Category | Percentage |\n";
    output += "|----------|------------|\n";
    output += `| Statements | ${coverage.statements || 0}% |\n`;
    output += `| Branches | ${coverage.branches || 0}% |\n`;
    output += `| Functions | ${coverage.functions || 0}% |\n`;
    output += `| Lines | ${coverage.lines || 0}% |\n\n`;

    return output;
  }

  /**
   * Calculate success rate
   */
  calculateSuccessRate(testResults) {
    const total = testResults.numTotalTests || 0;
    const passed = testResults.numPassedTests || 0;

    if (total === 0) return 0;
    return ((passed / total) * 100).toFixed(2);
  }

  /**
   * Format duration
   */
  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  /**
   * Ensure docs directory exists
   */
  ensureDocsDir() {
    if (!fs.existsSync(this.docsDir)) {
      fs.mkdirSync(this.docsDir, { recursive: true });
    }
  }

  /**
   * Save documentation
   */
  saveDocumentation(markdown) {
    this.ensureDocsDir();
    fs.writeFileSync(this.outputPath, markdown, "utf-8");
    console.log(`\n✅ Test documentation generated: ${this.outputPath}`);
  }

  /**
   * Main execution
   */
  async generate() {
    console.log("🚀 Test Documentation Generator\n");

    // Run tests
    const testResults = this.runTests();

    if (!testResults) {
      console.error("❌ Failed to get test results");
      process.exit(1);
    }

    // Generate markdown
    const markdown = this.generateMarkdown(testResults);

    // Save documentation
    this.saveDocumentation(markdown);

    console.log("✨ Documentation generation complete!\n");
  }
}

// Run generator
if (require.main === module) {
  const generator = new TestDocGenerator();
  generator.generate().catch((error) => {
    console.error("Error generating documentation:", error);
    process.exit(1);
  });
}

module.exports = TestDocGenerator;
