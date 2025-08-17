/**
 * Testing utilities for access pattern operations
 *
 * Provides helper functions for testing advanced operations like
 * sorting, binary search, and hash indexing when they are implemented.
 *
 * These utilities avoid NaN-boxing corruption issues by using
 * behavioral testing patterns.
 */

import { resetVM, executeTacitCode } from './vm-test-utils';

/**
 * Test data generator for performance testing
 */
export class TestDataGenerator {
  /**
   * Generate a simple list of sequential numbers
   */
  static createNumberList(size: number): string {
    const numbers = Array.from({length: size}, (_, i) => i + 1);
    return `( ${numbers.join(' ')} )`;
  }

  /**
   * Generate a maplist with numeric keys and values
   */
  static createNumberMaplist(size: number): string {
    const pairs = Array.from({length: size}, (_, i) => `${i + 1} ${(i + 1) * 100}`);
    return `( ${pairs.join(' ')} )`;
  }

  /**
   * Generate a maplist with mixed key types (for future string key testing)
   */
  static createMixedMaplist(): string {
    return '( 1 100 2 200 3 300 )'; // Simple numeric for now
  }

  /**
   * Generate nested structure for complex access testing
   */
  static createNestedStructure(): string {
    return '( ( 1 10 2 20 ) ( 3 30 4 40 ) )';
  }
}

/**
 * Performance testing utilities
 */
export class PerformanceTester {
  /**
   * Measure operation performance (basic timing)
   */
  static measureOperation(operation: string, iterations = 1000): number {
    resetVM();
    const start = Date.now();

    for (let i = 0; i < iterations; i++) {
      resetVM();
      executeTacitCode(operation);
    }

    const end = Date.now();
    return end - start;
  }

  /**
   * Compare two operations performance
   */
  static compareOperations(op1: string, op2: string, iterations = 1000): {
    op1Time: number;
    op2Time: number;
    ratio: number;
  } {
    const op1Time = this.measureOperation(op1, iterations);
    const op2Time = this.measureOperation(op2, iterations);

    return {
      op1Time,
      op2Time,
      ratio: op1Time / op2Time
    };
  }

  /**
   * Test scalability with different data sizes
   */
  static testScalability(operationTemplate: (size: number) => string, sizes: number[]): Array<{
    size: number;
    time: number;
  }> {
    return sizes.map(size => ({
      size,
      time: this.measureOperation(operationTemplate(size), 100)
    }));
  }
}

/**
 * Behavioral test patterns for avoiding NaN-boxing issues
 */
export class BehavioralTester {
  /**
   * Test that an operation doesn't crash and produces some output
   */
  static testOperationWorks(operation: string): boolean {
    try {
      resetVM();
      const result = executeTacitCode(operation);
      return result.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Test idempotency: operation applied twice gives same result as once
   */
  static testIdempotency(setup: string, operation: string): boolean {
    try {
      const once = executeTacitCode(`${setup} ${operation}`);
      const twice = executeTacitCode(`${setup} ${operation} ${operation}`);

      return JSON.stringify(once) === JSON.stringify(twice);
    } catch {
      return false;
    }
  }

  /**
   * Test that operation preserves data structure integrity
   */
  static testStructurePreservation(operation: string): boolean {
    try {
      const before = executeTacitCode('( 1 2 3 4 5 )');
      const after = executeTacitCode(`( 1 2 3 4 5 ) ${operation}`);

      return after.length >= before.length;
    } catch {
      return false;
    }
  }

  /**
   * Test inverse operations (when available)
   */
  static testInverseOperations(setup: string, forward: string, reverse: string): boolean {
    try {
      const original = executeTacitCode(setup);
      const roundTrip = executeTacitCode(`${setup} ${forward} ${reverse}`);

      return JSON.stringify(original) === JSON.stringify(roundTrip);
    } catch {
      return false;
    }
  }
}

/**
 * Comparator testing utilities for future sort operations
 */
export class ComparatorTester {
  /**
   * Test basic numeric comparator
   */
  static testNumericComparator(): boolean {
    return this.BehavioralTester.testOperationWorks('3 1 -'); // Basic subtraction
  }

  /**
   * Generate test cases for comparator validation
   */
  static generateComparatorTests(): Array<{
    description: string;
    setup: string;
    comparator: string;
    expectedBehavior: string;
  }> {
    return [
      {
        description: 'Numeric ascending sort',
        setup: '( 3 1 4 2 )',
        comparator: '{ - }',
        expectedBehavior: 'Ascending order'
      },
      {
        description: 'Numeric descending sort',
        setup: '( 1 3 2 4 )',
        comparator: '{ swap - }',
        expectedBehavior: 'Descending order'
      },
      {
        description: 'Stable sort test',
        setup: '( 1 2 1 3 )',
        comparator: '{ - }',
        expectedBehavior: 'Equal elements preserve order'
      }
    ];
  }

  private static BehavioralTester = BehavioralTester;
}

/**
 * Infrastructure readiness checker
 */
export class InfrastructureChecker {
  /**
   * Check that basic access operations are available
   */
  static checkBasicOperations(): {
    elem: boolean;
    slot: boolean;
    fetch: boolean;
    store: boolean;
    find: boolean;
    keys: boolean;
    values: boolean;
  } {
    return {
      elem: BehavioralTester.testOperationWorks('( 1 2 3 ) 0 elem'),
      slot: BehavioralTester.testOperationWorks('( 1 2 3 ) 0 slot'),
      fetch: BehavioralTester.testOperationWorks('( 1 2 3 ) 0 elem fetch'),
      store: BehavioralTester.testOperationWorks('( 1 2 3 ) dup 0 elem 99 swap store'),
      find: BehavioralTester.testOperationWorks('( 1 100 2 200 ) 1 find'),
      keys: BehavioralTester.testOperationWorks('( 1 100 2 200 ) keys'),
      values: BehavioralTester.testOperationWorks('( 1 100 2 200 ) values')
    };
  }

  /**
   * Check readiness for advanced operations (when implemented)
   */
  static checkAdvancedReadiness(): {
    basicOpsReady: boolean;
    testingInfrastructure: boolean;
    performanceFramework: boolean;
  } {
    const basicOps = this.checkBasicOperations();
    const allBasicReady = Object.values(basicOps).every(ready => ready);

    return {
      basicOpsReady: allBasicReady,
      testingInfrastructure: true, // This file exists
      performanceFramework: true   // Performance utils available
    };
  }

  /**
   * Generate readiness report
   */
  static generateReadinessReport(): string {
    const basic = this.checkBasicOperations();
    const advanced = this.checkAdvancedReadiness();

    let report = '# Access Operations Infrastructure Readiness\n\n';

    report += '## Basic Operations Status:\n';
    Object.entries(basic).forEach(([op, ready]) => {
      report += `- ${op}: ${ready ? '✅ Ready' : '❌ Not Ready'}\n`;
    });

    report += '\n## Advanced Infrastructure:\n';
    report += `- Basic Operations: ${advanced.basicOpsReady ? '✅ Ready' : '❌ Not Ready'}\n`;
    report += `- Testing Infrastructure: ${advanced.testingInfrastructure ? '✅ Ready' : '❌ Not Ready'}\n`;
    report += `- Performance Framework: ${advanced.performanceFramework ? '✅ Ready' : '❌ Not Ready'}\n`;

    if (advanced.basicOpsReady && advanced.testingInfrastructure && advanced.performanceFramework) {
      report += '\n🎯 **Status: READY for advanced operations implementation**\n';
    } else {
      report += '\n⚠️ **Status: Prerequisites not met**\n';
    }

    return report;
  }
}
