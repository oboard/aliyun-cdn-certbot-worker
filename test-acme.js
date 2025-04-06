import { getNewCertificate } from './utils/acme.js';
import { updateAliyunCDNCert } from './utils/aliyun.js';

// 加载环境变量
import { config } from 'dotenv';
config();

// 测试函数
async function test() {
  try {
    // 获取新证书
    const { key, certificate } = await getNewCertificate(process.env);

    // 更新阿里云 CDN 证书
    await updateAliyunCDNCert(key, certificate, process.env);

    console.log('测试成功');
  } catch (error) {
    console.error('测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
test();