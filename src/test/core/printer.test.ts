import { prn } from '../utils/core-test-utils';
import { toTaggedValue, Tag, MAX_TAG, tagNames } from '../../core/tagged';

let consoleOutput: string[] = [];
const originalConsoleWarn = console.warn;

describe('Printer', () => {
  beforeEach(() => {
    consoleOutput = [];
    console.warn = jest.fn((message: string) => {
      consoleOutput.push(message);
    });
  });

  afterEach(() => {
    console.warn = originalConsoleWarn;
  });

  describe('prn', () => {
    test('should print NUMBER tagged values', () => {
      const numberValue = toTaggedValue(42, Tag.NUMBER);
      prn('Test Number', numberValue);

      expect(consoleOutput).toHaveLength(1);
      expect(consoleOutput[0]).toMatch(/Test Number: NUMBER:/);
      expect(consoleOutput[0]).toContain('42');
    });

    test('should print CODE tagged values', () => {
      const codeValue = toTaggedValue(50, Tag.CODE);
      prn('Test Code', codeValue);

      expect(consoleOutput).toHaveLength(1);
      expect(consoleOutput[0]).toMatch(/Test Code: CODE: <code>/);
    });

    test('should print STRING tagged values', () => {
      const stringValue = toTaggedValue(287, Tag.STRING);
      prn('Test String', stringValue);

      expect(consoleOutput).toHaveLength(1);
      expect(consoleOutput[0]).toMatch(/Test String: STRING: "\[string:287\]"/);
    });

    test('should print LIST tagged values', () => {
      const listValue = toTaggedValue(3, Tag.LIST);
      prn('Test List', listValue);

      expect(consoleOutput).toHaveLength(1);
      expect(consoleOutput[0]).toMatch(/Test List: LIST:/);
    });

    test('should handle empty title', () => {
      const intValue = 42;
      prn('', intValue);

      expect(consoleOutput).toHaveLength(1);
      expect(consoleOutput[0]).toMatch(/^: NUMBER: 42$/);
    });

    test('should handle null title', () => {
      const intValue = 42;
      prn(null as unknown as string, intValue);

      expect(consoleOutput).toHaveLength(1);
      expect(consoleOutput[0]).toContain('NUMBER: 42');
    });

    test('should handle untagged NUMBER values', () => {
      const regularNumber = 3.14;
      prn('Regular Number', regularNumber);

      expect(consoleOutput).toHaveLength(1);
      expect(consoleOutput[0]).toMatch(/Regular Number: NUMBER:/);
      expect(consoleOutput[0]).toContain('3.14');
    });

    test('should handle special float values', () => {
      prn('NaN Value', NaN);
      expect(consoleOutput[0]).toMatch(/NaN Value: NUMBER:/);

      consoleOutput = [];
      prn('Infinity Value', Infinity);
      expect(consoleOutput[0]).toMatch(/Infinity Value: NUMBER:/);

      consoleOutput = [];
      prn('Negative Infinity', -Infinity);
      expect(consoleOutput[0]).toMatch(/Negative Infinity: NUMBER:/);
    });

    test('should handle unknown tag types gracefully', () => {
      const validTags = Object.values(Tag).filter(t => typeof t === 'number') as number[];
      const maxValidTag = Math.max(...validTags);

      expect(maxValidTag).toBe(MAX_TAG);

      const highTagValue = toTaggedValue(42, maxValidTag);
      prn('High Tag', highTagValue);

      expect(consoleOutput).toHaveLength(1);
      expect(consoleOutput[0]).toContain(': ');
      const expectedTagName = tagNames[maxValidTag as Tag];
      expect(consoleOutput[0]).toContain(`${expectedTagName}:`);
    });

    test('should format output correctly with indentation', () => {
      const intValue = 42;
      prn('Indented Test', intValue);

      expect(consoleOutput).toHaveLength(1);
      expect(consoleOutput[0]).toMatch(/^Indented Test: NUMBER: 42$/);
    });

    test('should handle large string indices', () => {
      const largeStringValue = toTaggedValue(65535, Tag.STRING);
      prn('Large String Index', largeStringValue);

      expect(consoleOutput).toHaveLength(1);
      expect(consoleOutput[0]).toMatch(/Large String Index: STRING: "\[string:65535\]"/);
    });

    test('should handle edge case values for different tag types', () => {
      const smallCode = toTaggedValue(0, Tag.CODE);
      prn('Small Code', smallCode);
      expect(consoleOutput[0]).toMatch(/Small Code: CODE: <code>/);

      consoleOutput = [];
      const largeCode = toTaggedValue(1000, Tag.CODE);
      prn('Large Code', largeCode);
      expect(consoleOutput[0]).toMatch(/Large Code: CODE: <code>/);
    });

    test('should work with LIST tag values of different sizes', () => {
      const smallList = toTaggedValue(0, Tag.LIST);
      prn('Empty List', smallList);
      expect(consoleOutput[0]).toMatch(/Empty List: LIST:/);

      consoleOutput = [];
      const largeList = toTaggedValue(1000, Tag.LIST);
      prn('Large List', largeList);
      expect(consoleOutput[0]).toMatch(/Large List: LIST:/);
    });
  });

  describe('integration with tagged values', () => {
    test('should correctly format all standard tag types', () => {
      const testCases = [
        { tag: Tag.NUMBER, value: 3.14, title: 'Number' },
        { tag: Tag.CODE, value: 100, title: 'Code' },
        { tag: Tag.STRING, value: 200, title: 'String' },
        { tag: Tag.LIST, value: 5, title: 'List' },
      ];

      testCases.forEach(({ tag, value, title }) => {
        consoleOutput = [];
        const taggedValue = toTaggedValue(value, tag);
        prn(title, taggedValue);

        expect(consoleOutput).toHaveLength(1);
        expect(consoleOutput[0]).toContain(`${title}:`);

        if (tag === Tag.NUMBER) {
          expect(consoleOutput[0]).toMatch(/NUMBER:/);
        } else if (tag === Tag.CODE) {
          expect(consoleOutput[0]).toMatch(/CODE:/);
        } else if (tag === Tag.STRING) {
          expect(consoleOutput[0]).toMatch(/STRING:/);
        } else if (tag === Tag.LIST) {
          expect(consoleOutput[0]).toMatch(/LIST:/);
        }
      });
    });

    test('should handle multiple consecutive prints', () => {
  const value1 = 1;
  const value2 = 2;
  const value3 = 3;

  prn('First', value1);
  prn('Second', value2);
  prn('Third', value3);

  expect(consoleOutput).toHaveLength(3);
  expect(consoleOutput[0]).toMatch(/First: NUMBER: 1/);
  expect(consoleOutput[1]).toMatch(/Second: NUMBER: 2/);
  expect(consoleOutput[2]).toMatch(/Third: NUMBER: 3/);
    });
  });
});
