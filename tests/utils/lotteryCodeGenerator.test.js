const lotteryCodeGenerator = require('../../src/utils/lotteryCodeGenerator');

describe('抽奖码生成器测试', () => {
  describe('generateLotteryCode', () => {
    it('应该生成4位数字抽奖码', () => {
      const code = lotteryCodeGenerator.generateLotteryCode('4_digit_number');
      
      expect(code).toMatch(/^\d{4}$/);
      expect(code.length).toBe(4);
    });

    it('应该生成8位数字抽奖码', () => {
      const code = lotteryCodeGenerator.generateLotteryCode('8_digit_number');
      
      expect(code).toMatch(/^\d{8}$/);
      expect(code.length).toBe(8);
    });

    it('应该生成12位数字抽奖码', () => {
      const code = lotteryCodeGenerator.generateLotteryCode('12_digit_number');
      
      expect(code).toMatch(/^\d{12}$/);
      expect(code.length).toBe(12);
    });

    it('应该生成8位数字字母混合抽奖码', () => {
      const code = lotteryCodeGenerator.generateLotteryCode('8_digit_alphanumeric');
      
      expect(code).toMatch(/^[0-9a-z]{8}$/);
      expect(code.length).toBe(8);
    });

    it('应该生成12位数字字母混合抽奖码', () => {
      const code = lotteryCodeGenerator.generateLotteryCode('12_digit_alphanumeric');
      
      expect(code).toMatch(/^[0-9a-zA-Z]{12}$/);
      expect(code.length).toBe(12);
    });

    it('应该处理无效的格式', () => {
      expect(() => {
        lotteryCodeGenerator.generateLotteryCode('invalid_format');
      }).toThrow('不支持的抽奖码格式');
    });
  });

  describe('generateBatchLotteryCodes', () => {
    it('应该生成指定数量的唯一抽奖码', () => {
      const codes = lotteryCodeGenerator.generateBatchLotteryCodes('8_digit_number', 5);
      
      expect(codes).toHaveLength(5);
      codes.forEach(code => {
        expect(code).toMatch(/^\d{8}$/);
      });
      
      // 验证唯一性
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(5);
    });

    it('应该生成大量唯一抽奖码', () => {
      const codes = lotteryCodeGenerator.generateBatchLotteryCodes('4_digit_number', 100);
      
      expect(codes).toHaveLength(100);
      codes.forEach(code => {
        expect(code).toMatch(/^\d{4}$/);
      });
      
      // 验证唯一性
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(100);
    });

    it('应该处理数量为0的情况', () => {
      const codes = lotteryCodeGenerator.generateBatchLotteryCodes('8_digit_number', 0);
      
      expect(codes).toHaveLength(0);
      expect(Array.isArray(codes)).toBe(true);
    });

    it('应该处理负数数量', () => {
      expect(() => {
        lotteryCodeGenerator.generateBatchLotteryCodes('8_digit_number', -1);
      }).toThrow('数量必须大于0');
    });
  });

  describe('validateLotteryCodeFormat', () => {
    it('应该验证4位数字格式', () => {
      expect(lotteryCodeGenerator.validateLotteryCodeFormat('1234', '4_digit_number')).toBe(true);
      expect(lotteryCodeGenerator.validateLotteryCodeFormat('123', '4_digit_number')).toBe(false);
      expect(lotteryCodeGenerator.validateLotteryCodeFormat('12345', '4_digit_number')).toBe(false);
      expect(lotteryCodeGenerator.validateLotteryCodeFormat('12a4', '4_digit_number')).toBe(false);
    });

    it('应该验证8位数字格式', () => {
      expect(lotteryCodeGenerator.validateLotteryCodeFormat('12345678', '8_digit_number')).toBe(true);
      expect(lotteryCodeGenerator.validateLotteryCodeFormat('1234567', '8_digit_number')).toBe(false);
      expect(lotteryCodeGenerator.validateLotteryCodeFormat('123456789', '8_digit_number')).toBe(false);
      expect(lotteryCodeGenerator.validateLotteryCodeFormat('1234567a', '8_digit_number')).toBe(false);
    });

    it('应该验证12位数字格式', () => {
      expect(lotteryCodeGenerator.validateLotteryCodeFormat('123456789012', '12_digit_number')).toBe(true);
      expect(lotteryCodeGenerator.validateLotteryCodeFormat('12345678901', '12_digit_number')).toBe(false);
      expect(lotteryCodeGenerator.validateLotteryCodeFormat('1234567890123', '12_digit_number')).toBe(false);
      expect(lotteryCodeGenerator.validateLotteryCodeFormat('12345678901a', '12_digit_number')).toBe(false);
    });

    it('应该验证8位数字字母混合格式', () => {
      expect(lotteryCodeGenerator.validateLotteryCodeFormat('12345678', '8_digit_alphanumeric')).toBe(true);
      expect(lotteryCodeGenerator.validateLotteryCodeFormat('1234567a', '8_digit_alphanumeric')).toBe(true);
      expect(lotteryCodeGenerator.validateLotteryCodeFormat('1234567', '8_digit_alphanumeric')).toBe(false);
      expect(lotteryCodeGenerator.validateLotteryCodeFormat('123456789', '8_digit_alphanumeric')).toBe(false);
      expect(lotteryCodeGenerator.validateLotteryCodeFormat('1234567A', '8_digit_alphanumeric')).toBe(false);
    });

    it('应该验证12位数字字母混合格式', () => {
      expect(lotteryCodeGenerator.validateLotteryCodeFormat('123456789012', '12_digit_alphanumeric')).toBe(true);
      expect(lotteryCodeGenerator.validateLotteryCodeFormat('12345678901a', '12_digit_alphanumeric')).toBe(true);
      expect(lotteryCodeGenerator.validateLotteryCodeFormat('12345678901A', '12_digit_alphanumeric')).toBe(true);
      expect(lotteryCodeGenerator.validateLotteryCodeFormat('12345678901', '12_digit_alphanumeric')).toBe(false);
      expect(lotteryCodeGenerator.validateLotteryCodeFormat('1234567890123', '12_digit_alphanumeric')).toBe(false);
    });

    it('应该处理无效的格式', () => {
      expect(() => {
        lotteryCodeGenerator.validateLotteryCodeFormat('1234', 'invalid_format');
      }).toThrow('不支持的抽奖码格式');
    });
  });

  describe('getSupportedFormats', () => {
    it('应该返回支持的格式列表', () => {
      const formats = lotteryCodeGenerator.getSupportedFormats();
      
      expect(Array.isArray(formats)).toBe(true);
      expect(formats.length).toBe(5);
      
      const formatNames = formats.map(f => f.format);
      expect(formatNames).toContain('4_digit_number');
      expect(formatNames).toContain('8_digit_number');
      expect(formatNames).toContain('12_digit_number');
      expect(formatNames).toContain('8_digit_alphanumeric');
      expect(formatNames).toContain('12_digit_alphanumeric');
    });
  });

  describe('getFormatDescription', () => {
    it('应该返回格式描述', () => {
      expect(lotteryCodeGenerator.getFormatDescription('4_digit_number')).toBe('4位纯数字');
      expect(lotteryCodeGenerator.getFormatDescription('8_digit_number')).toBe('8位纯数字');
      expect(lotteryCodeGenerator.getFormatDescription('12_digit_number')).toBe('12位纯数字');
      expect(lotteryCodeGenerator.getFormatDescription('8_digit_alphanumeric')).toBe('8位数字+小写字母');
      expect(lotteryCodeGenerator.getFormatDescription('12_digit_alphanumeric')).toBe('12位数字+字母');
    });

    it('应该处理无效格式', () => {
      expect(lotteryCodeGenerator.getFormatDescription('invalid_format')).toBe('未知格式');
    });
  });

  describe('generateBatchLotteryCodes with retry', () => {
    it('应该生成指定数量的抽奖码（带重试机制）', () => {
      const codes = lotteryCodeGenerator.generateBatchLotteryCodes('8_digit_number', 10);
      
      expect(codes).toHaveLength(10);
      codes.forEach(code => {
        expect(code).toMatch(/^\d{8}$/);
      });
      
      // 验证唯一性
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(10);
    });

    it('应该处理大量代码生成', () => {
      // 测试生成大量代码
      const codes = lotteryCodeGenerator.generateBatchLotteryCodes('4_digit_number', 50);
      
      expect(codes.length).toBe(50);
      expect(codes.length).toBeGreaterThan(0);
    });
  });

  describe('性能测试', () => {
    it('应该能够快速生成大量抽奖码', () => {
      const startTime = Date.now();
      const codes = lotteryCodeGenerator.generateBatchLotteryCodes('8_digit_number', 1000);
      const endTime = Date.now();
      
      expect(codes).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(5000); // 5秒内完成
      
      // 验证唯一性
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(1000);
    });
  });
}); 