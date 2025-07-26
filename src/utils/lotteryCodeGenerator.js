const crypto = require('crypto');

/**
 * 抽奖码格式映射
 */
const CODE_FORMATS = {
  '4_digit_number': {
    length: 4,
    charset: '0123456789'
  },
  '8_digit_number': {
    length: 8,
    charset: '0123456789'
  },
  '8_digit_alphanumeric': {
    length: 8,
    charset: '0123456789abcdefghijklmnopqrstuvwxyz'
  },
  '12_digit_number': {
    length: 12,
    charset: '0123456789'
  },
  '12_digit_alphanumeric': {
    length: 12,
    charset: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  }
};

/**
 * 生成指定格式的随机抽奖码
 * @param {string} format - 抽奖码格式
 * @returns {string} 生成的抽奖码
 */
const generateLotteryCode = (format) => {
  const config = CODE_FORMATS[format];
  if (!config) {
    throw new Error(`不支持的抽奖码格式: ${format}`);
  }

  const { length, charset } = config;
  let result = '';
  
  // 使用加密安全的随机数生成器
  const randomBytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    const randomIndex = randomBytes[i] % charset.length;
    result += charset[randomIndex];
  }
  
  return result;
};

/**
 * 批量生成抽奖码，确保不重复
 * @param {string} format - 抽奖码格式
 * @param {number} count - 生成数量
 * @param {string[]} existingCodes - 已存在的抽奖码列表
 * @returns {string[]} 生成的抽奖码数组
 */
const generateBatchLotteryCodes = (format, count, existingCodes = []) => {
  if (count < 0) {
    throw new Error('数量必须大于0');
  }
  
  if (count === 0) {
    return [];
  }
  
  const codes = new Set(existingCodes);
  const newCodes = [];
  
  // 计算理论最大值，避免无限循环
  const config = CODE_FORMATS[format];
  if (!config) {
    throw new Error('不支持的抽奖码格式');
  }
  
  const maxPossibleCodes = Math.pow(config.charset.length, config.length);
  
  if (codes.size + count > maxPossibleCodes) {
    throw new Error('请求生成的抽奖码数量超过格式限制');
  }
  
  let attempts = 0;
  const maxAttempts = count * 10; // 最多尝试10倍次数
  
  while (newCodes.length < count && attempts < maxAttempts) {
    const code = generateLotteryCode(format);
    
    if (!codes.has(code)) {
      codes.add(code);
      newCodes.push(code);
    }
    
    attempts++;
  }
  
  if (newCodes.length < count) {
    throw new Error('生成抽奖码失败，可能格式空间不足或存在大量重复');
  }
  
  return newCodes;
};

/**
 * 验证抽奖码格式是否正确
 * @param {string} code - 抽奖码
 * @param {string} format - 期望的格式
 * @returns {boolean} 是否符合格式
 */
const validateLotteryCodeFormat = (code, format) => {
  const config = CODE_FORMATS[format];
  if (!config) {
    throw new Error('不支持的抽奖码格式');
  }
  
  if (code.length !== config.length) {
    return false;
  }
  
  const charsetSet = new Set(config.charset);
  for (const char of code) {
    if (!charsetSet.has(char)) {
      return false;
    }
  }
  
  return true;
};

/**
 * 获取支持的抽奖码格式列表
 * @returns {object} 格式配置对象
 */
const getSupportedFormats = () => {
  return Object.keys(CODE_FORMATS).map(format => ({
    format,
    description: getFormatDescription(format),
    example: generateLotteryCode(format)
  }));
};

/**
 * 获取格式描述
 * @param {string} format - 格式代码
 * @returns {string} 格式描述
 */
const getFormatDescription = (format) => {
  const descriptions = {
    '4_digit_number': '4位纯数字',
    '8_digit_number': '8位纯数字',
    '8_digit_alphanumeric': '8位数字+小写字母',
    '12_digit_number': '12位纯数字',
    '12_digit_alphanumeric': '12位数字+字母'
  };
  
  return descriptions[format] || '未知格式';
};

module.exports = {
  generateLotteryCode,
  generateBatchLotteryCodes,
  validateLotteryCodeFormat,
  getSupportedFormats,
  getFormatDescription,
  CODE_FORMATS
}; 