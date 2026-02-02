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
      // Run tests with JSON reporter and suppress console output
      const output = execSync("npm test -- --json --silent --noStackTrace", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      // Try to find JSON in the output
      const lines = output.split("\n");
      let jsonStr = "";
      let foundJson = false;

      // Look for lines that start with { or are part of JSON
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith("{")) {
          foundJson = true;
          jsonStr = lines.slice(i).join("\n");
          break;
        }
      }

      if (!foundJson) {
        console.error("No JSON found in test output");
        return null;
      }

      return JSON.parse(jsonStr);
    } catch (error) {
      // Tests may fail but we still want the results
      if (error.stdout) {
        try {
          // Try to extract JSON from stdout
          const lines = error.stdout.split("\n");
          let jsonStr = "";

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith("{")) {
              jsonStr = lines.slice(i).join("\n");
              break;
            }
          }

          if (jsonStr) {
            return JSON.parse(jsonStr);
          }
        } catch (parseError) {
          console.error("Failed to parse test output from error stdout");
        }
      }

      // If JSON parsing failed, try alternative approach
      console.log("Trying alternative test execution...");
      return this.runTestsAlternative();
    }
  }

  /**
   * Alternative test runner that creates a temporary JSON file
   */
  runTestsAlternative() {
    const tempFile = path.join(__dirname, "../test-results.json");

    try {
      // Run tests and output to file
      execSync(
        `npm test -- --json --outputFile="${tempFile}" --silent --noStackTrace`,
        {
          encoding: "utf-8",
          stdio: "inherit",
        },
      );

      if (fs.existsSync(tempFile)) {
        const data = JSON.parse(fs.readFileSync(tempFile, "utf-8"));
        fs.unlinkSync(tempFile); // Clean up
        return data;
      }
    } catch (error) {
      if (fs.existsSync(tempFile)) {
        try {
          const data = JSON.parse(fs.readFileSync(tempFile, "utf-8"));
          fs.unlinkSync(tempFile);
          return data;
        } catch (e) {
          console.error("Failed to read temp file");
        }
      }
    }

    return null;
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
    markdown += `| Duration | ${this.formatDuration((testResults.testResults || []).reduce((sum, t) => sum + (t.perfStats?.runtime || 0), 0))} |\n\n`;

    // Test Suites
    markdown += `## 📁 Test Suites\n\n`;

    if (testResults.testResults) {
      const groupedTests = this.groupTestsByType(testResults.testResults);

      markdown += `### Unit Tests\n\n`;
      markdown += this.formatTestGroup(groupedTests.unit);

      markdown += `### Integration Tests\n\n`;
      markdown += this.formatTestGroup(groupedTests.integration);

      markdown += `### System Tests\n\n`;
      markdown += this.formatTestGroup(groupedTests.system);
    }

    // Failed Tests Detail
    if (testResults.numFailedTests > 0 && testResults.testResults) {
      markdown += `## ❌ Failed Tests\n\n`;

      testResults.testResults.forEach((testFile) => {
        if (testFile.numFailingTests > 0 && testFile.assertionResults) {
          const failedAssertions = testFile.assertionResults.filter(
            (a) => a.status === "failed",
          );

          if (failedAssertions.length > 0) {
            markdown += `### ${path.basename(testFile.name)}\n\n`;

            failedAssertions.forEach((assertion) => {
              const fullName =
                assertion.ancestorTitles.length > 0
                  ? `${assertion.ancestorTitles.join(" > ")} > ${assertion.title}`
                  : assertion.title;

              markdown += `**${fullName}**\n\n`;

              if (
                assertion.failureMessages &&
                assertion.failureMessages.length > 0
              ) {
                markdown += `\`\`\`\n${assertion.failureMessages[0]}\n\`\`\`\n\n`;
              }
            });
          }
        }
      });
    }

    // Test Categories
    markdown += `## 📂 Test Categories\n\n`;
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
      const status = test.numFailingTests === 0 ? "✅" : "❌";
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
      console.log("\nTrying to generate basic documentation...");

      // Generate a basic report
      const basicMarkdown = this.generateBasicReport();
      this.saveDocumentation(basicMarkdown);
      return;
    }

    // Generate markdown
    const markdown = this.generateMarkdown(testResults);

    // Save documentation
    this.saveDocumentation(markdown);

    console.log("✅ Documentation generation complete!\n");
  }

  /**
   * Generate basic report when JSON parsing fails
   */
  generateBasicReport() {
    const timestamp = new Date().toISOString();

    let markdown = `# Test Results Documentation\n\n`;
    markdown += `**Generated:** ${timestamp}\n\n`;
    markdown += `**Note:** This is a basic report. Run tests manually to see detailed results.\n\n`;
    markdown += `---\n\n`;
    markdown += `## Run Tests\n\n`;
    markdown += `\`\`\`bash\n`;
    markdown += `npm test\n`;
    markdown += `\`\`\`\n\n`;
    markdown += `## Test Categories\n\n`;
    markdown += `- **Unit Tests**: \`npm run test:unit\`\n`;
    markdown += `- **Integration Tests**: \`npm run test:integration\`\n`;
    markdown += `- **System Tests**: \`npm run test:system\`\n`;

    return markdown;
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
