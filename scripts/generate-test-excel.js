const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const XLSX = require("xlsx");

/**
 * Generate Test Documentation in Excel Format
 */
class TestExcelGenerator {
  constructor() {
    this.outputPath = path.join(__dirname, "../docs/TEST_RESULTS.xlsx");
    this.docsDir = path.join(__dirname, "../docs");
    this.testCounter = 1;
  }

  /**
   * Run tests and capture output
   */
  runTests() {
    console.log("Running test suite...\n");

    try {
      // Run tests with JSON reporter
      const output = execSync("npm test -- --json --silent --noStackTrace", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        maxBuffer: 10 * 1024 * 1024,
      });

      // Try to find JSON in the output
      const lines = output.split("\n");
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
    } catch (error) {
      if (error.stdout) {
        try {
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
          console.error("Failed to parse test output");
        }
      }

      // Try alternative approach
      console.log("Trying alternative test execution...");
      return this.runTestsAlternative();
    }

    return null;
  }

  /**
   * Alternative test runner using temp file
   */
  runTestsAlternative() {
    const tempFile = path.join(__dirname, "../test-results.json");

    try {
      execSync(
        `npm test -- --json --outputFile="${tempFile}" --silent --noStackTrace`,
        {
          encoding: "utf-8",
          stdio: "inherit",
        },
      );

      if (fs.existsSync(tempFile)) {
        const data = JSON.parse(fs.readFileSync(tempFile, "utf-8"));
        fs.unlinkSync(tempFile);
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
   * Extract endpoint and method from test name
   */
  extractEndpointInfo(testName, testFile) {
    const endpointPatterns = {
      register: { endpoint: "/api/auth/register", method: "POST" },
      login: { endpoint: "/api/auth/login", method: "POST" },
      logout: { endpoint: "/api/auth/logout", method: "POST" },
      "change-password": {
        endpoint: "/api/auth/change-password",
        method: "PUT",
      },
      profile: { endpoint: "/api/auth/profile", method: "PUT" },
      "/api/auth/me": { endpoint: "/api/auth/me", method: "GET" },
      refresh: { endpoint: "/api/auth/refresh", method: "POST" },
      "/api/features": { endpoint: "/api/features", method: "GET/POST" },
      "feature toggle": { endpoint: "/api/features", method: "POST" },
      "check feature": { endpoint: "/api/features/check", method: "POST" },
      "/api/users": { endpoint: "/api/users", method: "GET" },
      "user role": { endpoint: "/api/users/:id/role", method: "PUT" },
      deactivate: { endpoint: "/api/users/:id/deactivate", method: "PUT" },
      activate: { endpoint: "/api/users/:id/activate", method: "PUT" },
      unlock: { endpoint: "/api/users/:id/unlock", method: "PUT" },
      "rate guard": { endpoint: "/api/rate-guards", method: "POST" },
      "rate limit": { endpoint: "/api/rate-guards/test", method: "POST" },
      "/api/audit": { endpoint: "/api/audit", method: "GET" },
    };

    const lowerName = testName.toLowerCase();

    for (const [pattern, info] of Object.entries(endpointPatterns)) {
      if (lowerName.includes(pattern.toLowerCase())) {
        return info;
      }
    }

    if (testFile.includes("auth")) {
      return { endpoint: "/api/auth/*", method: "VARIOUS" };
    } else if (testFile.includes("feature")) {
      return { endpoint: "/api/features/*", method: "VARIOUS" };
    } else if (testFile.includes("user")) {
      return { endpoint: "/api/users/*", method: "VARIOUS" };
    }

    return { endpoint: "N/A", method: "N/A" };
  }

  /**
   * Categorize test based on file path
   */
  categorizeTest(testFile) {
    if (testFile.includes("/unit/")) return "Unit Test";
    if (testFile.includes("/integration/")) return "Integration Test";
    if (testFile.includes("/system/")) return "System Test";
    return "General Test";
  }

  /**
   * Extract expected result from test name
   */
  extractExpectedResult(testName) {
    const lowerName = testName.toLowerCase();

    if (
      lowerName.includes("should not") ||
      lowerName.includes("should reject")
    ) {
      return "Request should fail with appropriate error";
    }
    if (lowerName.includes("should require")) {
      return "Authentication/Authorization required";
    }
    if (
      lowerName.includes("should return") ||
      lowerName.includes("should get")
    ) {
      return "Successful response with data";
    }
    if (lowerName.includes("should create")) {
      return "Resource created successfully (201)";
    }
    if (lowerName.includes("should update")) {
      return "Resource updated successfully (200)";
    }
    if (lowerName.includes("should delete")) {
      return "Resource deleted successfully (200)";
    }
    if (
      lowerName.includes("should login") ||
      lowerName.includes("should register")
    ) {
      return "Authentication successful with tokens";
    }
    if (lowerName.includes("should validate")) {
      return "Validation error (400)";
    }
    if (lowerName.includes("should lock")) {
      return "Account locked (423)";
    }

    return "Test assertion passes";
  }

  /**
   * Parse individual test results
   */
  parseTestResults(testResults) {
    const parsedTests = [];
    const currentDate = new Date().toISOString().split("T")[0];
    const environment = process.env.NODE_ENV || "test";

    if (!testResults.testResults) return parsedTests;

    testResults.testResults.forEach((testFile) => {
      const fileName = path.basename(testFile.name);
      const category = this.categorizeTest(testFile.name);

      if (testFile.assertionResults) {
        testFile.assertionResults.forEach((assertion) => {
          const testName = assertion.title;
          const ancestorTitles = assertion.ancestorTitles.join(" > ");
          const fullTestName = ancestorTitles
            ? `${ancestorTitles} > ${testName}`
            : testName;

          const endpointInfo = this.extractEndpointInfo(testName, fileName);
          const expectedResult = this.extractExpectedResult(testName);

          const status = assertion.status === "passed" ? "PASS" : "FAIL";
          const actualResult =
            assertion.status === "passed"
              ? "Test passed as expected"
              : (assertion.failureMessages?.[0] || "Test failed").substring(
                  0,
                  200,
                );

          const execTime = assertion.duration || 0;

          parsedTests.push({
            testId: `TEST-${String(this.testCounter++).padStart(4, "0")}`,
            category: category,
            testName: fullTestName,
            endpoint: endpointInfo.endpoint,
            method: endpointInfo.method,
            expectedResult: expectedResult,
            actualResult: actualResult,
            status: status,
            execTime: execTime,
            environment: environment,
            tester: "Automated Test Suite",
            date: currentDate,
            bugId: status === "FAIL" ? "PENDING" : "",
            notes: `File: ${fileName}`,
          });
        });
      }
    });

    return parsedTests;
  }

  /**
   * Generate Excel workbook
   */
  generateExcel(testResults) {
    const workbook = XLSX.utils.book_new();
    const parsedTests = this.parseTestResults(testResults);

    // Main Test Results Sheet
    const headers = [
      "Test ID",
      "Category",
      "Test Name",
      "Endpoint",
      "Method",
      "Expected Result",
      "Actual Result",
      "Status",
      "Exec Time (ms)",
      "Environment",
      "Tester",
      "Date",
      "Bug ID",
      "Notes",
    ];

    const data = [headers];

    parsedTests.forEach((test) => {
      data.push([
        test.testId,
        test.category,
        test.testName,
        test.endpoint,
        test.method,
        test.expectedResult,
        test.actualResult,
        test.status,
        test.execTime,
        test.environment,
        test.tester,
        test.date,
        test.bugId,
        test.notes,
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(data);

    // Set column widths
    worksheet["!cols"] = [
      { wch: 12 },
      { wch: 18 },
      { wch: 50 },
      { wch: 30 },
      { wch: 10 },
      { wch: 40 },
      { wch: 40 },
      { wch: 10 },
      { wch: 15 },
      { wch: 15 },
      { wch: 20 },
      { wch: 12 },
      { wch: 12 },
      { wch: 30 },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, "Test Results");

    // Summary Sheet
    const summaryData = [
      ["Test Execution Summary"],
      ["Generated", new Date().toISOString()],
      [],
      ["Metric", "Value"],
      ["Total Tests", testResults.numTotalTests || 0],
      ["Passed", testResults.numPassedTests || 0],
      ["Failed", testResults.numFailedTests || 0],
      ["Pending", testResults.numPendingTests || 0],
      ["Success Rate", this.calculateSuccessRate(testResults) + "%"],
      [],
      ["Test Breakdown by Category"],
      ["Category", "Total", "Passed", "Failed", "Pass Rate"],
    ];

    const categories = {};
    parsedTests.forEach((test) => {
      if (!categories[test.category]) {
        categories[test.category] = { total: 0, passed: 0, failed: 0 };
      }
      categories[test.category].total++;
      if (test.status === "PASS") {
        categories[test.category].passed++;
      } else {
        categories[test.category].failed++;
      }
    });

    Object.entries(categories).forEach(([category, stats]) => {
      const passRate = ((stats.passed / stats.total) * 100).toFixed(2);
      summaryData.push([
        category,
        stats.total,
        stats.passed,
        stats.failed,
        `${passRate}%`,
      ]);
    });

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet["!cols"] = [
      { wch: 30 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
    ];

    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    // Failed Tests Sheet
    const failedTests = parsedTests.filter((test) => test.status === "FAIL");
    if (failedTests.length > 0) {
      const failedData = [headers];
      failedTests.forEach((test) => {
        failedData.push([
          test.testId,
          test.category,
          test.testName,
          test.endpoint,
          test.method,
          test.expectedResult,
          test.actualResult,
          test.status,
          test.execTime,
          test.environment,
          test.tester,
          test.date,
          test.bugId,
          test.notes,
        ]);
      });

      const failedSheet = XLSX.utils.aoa_to_sheet(failedData);
      failedSheet["!cols"] = worksheet["!cols"];
      XLSX.utils.book_append_sheet(workbook, failedSheet, "Failed Tests");
    }

    return workbook;
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
   * Ensure docs directory exists
   */
  ensureDocsDir() {
    if (!fs.existsSync(this.docsDir)) {
      fs.mkdirSync(this.docsDir, { recursive: true });
    }
  }

  /**
   * Save Excel file
   */
  saveExcel(workbook) {
    this.ensureDocsDir();
    XLSX.writeFile(workbook, this.outputPath);
    console.log(`\n✅ Excel report generated: ${this.outputPath}`);
  }

  /**
   * Main execution
   */
  async generate() {
    console.log("📊 Test Excel Generator\n");

    const testResults = this.runTests();

    if (!testResults) {
      console.error("❌ Failed to get test results");
      console.log("\nPlease run: npm test");
      process.exit(1);
    }

    console.log(`Found ${testResults.numTotalTests || 0} tests\n`);

    const workbook = this.generateExcel(testResults);
    this.saveExcel(workbook);

    console.log("✅ Excel generation complete!\n");
    console.log("📊 Report contains:");
    console.log("   - Test Results (detailed test cases)");
    console.log("   - Summary (statistics and breakdown)");
    if (testResults.numFailedTests > 0) {
      console.log("   - Failed Tests (failures only)\n");
    }
  }
}

// Run generator
if (require.main === module) {
  const generator = new TestExcelGenerator();
  generator.generate().catch((error) => {
    console.error("Error generating Excel:", error);
    process.exit(1);
  });
}

module.exports = TestExcelGenerator;
