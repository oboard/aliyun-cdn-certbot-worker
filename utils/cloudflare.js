// 更新 Cloudflare DNS 记录
export async function updateCloudflareDNS(challengeDomain, dnsRecord, env) {
  // 获取现有的记录
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/dns_records?name=${challengeDomain}&type=TXT`, {
    headers: {
      'X-Auth-Email': env.CF_EMAIL,
      'X-Auth-Key': env.CF_API_KEY,
      'Content-Type': 'application/json',
    },
  });
  const existingRecords = await response.json();
  if (!existingRecords.success) {
    console.log('获取现有的记录失败', existingRecords);
    throw new Error('获取现有的记录失败');
  }
  console.log('获取现有的记录成功', existingRecords);

  // 删除现有的记录
  for (const record of existingRecords.result) {
    await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/dns_records/${record.id}`, {
      method: 'DELETE',
      headers: {
        'X-Auth-Email': env.CF_EMAIL,
        'X-Auth-Key': env.CF_API_KEY,
      },
    });
  }

  // 添加新的记录
  const addResponse = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/dns_records`, {
    method: 'POST',
    headers: {
      'X-Auth-Email': env.CF_EMAIL,
      'X-Auth-Key': env.CF_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'TXT',
      name: challengeDomain,
      content: dnsRecord,
      ttl: 120,
      proxied: false,
      comment: 'Let\'s Encrypt DNS-01 challenge'
    }),
  });

  const addJson = await addResponse.json();
  if (!addJson.success) {
    console.log('添加 DNS 记录失败', addJson);
    throw new Error('添加 DNS 记录失败');
  }
  console.log('添加 DNS 记录成功', addJson);

  return addJson;
}

// 删除 Cloudflare DNS 记录
export async function removeCloudflareDNS(challengeDomain, dnsRecord, env) {
  // 获取现有的记录
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/dns_records?name=${challengeDomain}&type=TXT`, {
    headers: {
      'X-Auth-Email': env.CF_EMAIL,
      'X-Auth-Key': env.CF_API_KEY,
      'Content-Type': 'application/json',
    },
  });
  const existingRecords = await response.json();
  if (!existingRecords.success) {
    console.log('获取现有的记录失败', existingRecords);
    throw new Error('获取现有的记录失败');
  }
  console.log('获取现有的记录成功', existingRecords);

  // 删除现有的记录
  for (const record of existingRecords.result) {
    await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/dns_records/${record.id}`, {
      method: 'DELETE',
      headers: {
        'X-Auth-Email': env.CF_EMAIL,
        'X-Auth-Key': env.CF_API_KEY,
      },
    });
  }
  console.log('删除现有的记录成功');
} 