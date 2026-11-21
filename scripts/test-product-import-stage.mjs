const ADMIN_EMAIL = 'admin@sai-ajanta.com';
const ADMIN_PASSWORD = 'Admin1234!';
const BASE_URL = 'http://localhost:9000';

async function main() {
  console.log('--- Testing Product Import Staging API ---');
  const authRes = await fetch(`${BASE_URL}/auth/user/emailpass`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const { token } = await authRes.json();
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const sampleCsv = `sku,name,category,subcategory,brand,size,material,billing_unit,customer_price_inr,dealer_price_inr,distributor_price_inr,gst_rate,stock_qty,is_manufactured,src,description
SA-TEST-IMPORT-001,Test Staged Product One,Aluminium,Extrusions,Sai Ajantha,50mm,Alloy,1 unit,1500,1200,1000,18,10,true,,Staging test product description
`;

  const stageRes = await fetch(`${BASE_URL}/admin/sai-ajanta/products/import/stage`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      fileName: 'test-import.csv',
      fileContentText: sampleCsv,
    }),
  });

  const stageData = await stageRes.json();
  console.log(`[POST ${stageRes.status}] /admin/sai-ajanta/products/import/stage ->`, stageData.jobId ? `Job ID: ${stageData.jobId}, Staged Rows: ${stageData.stagedRows}` : stageData);

  if (stageRes.ok && stageData.jobId) {
    const getJobRes = await fetch(`${BASE_URL}/admin/sai-ajanta/products/import/jobs/${stageData.jobId}`, { headers });
    const getJobData = await getJobRes.json();
    console.log(`[GET ${getJobRes.status}] /admin/sai-ajanta/products/import/jobs/${stageData.jobId} -> Status: ${getJobData.status}, Total: ${getJobData.totalRows}`);
  }
}

main().catch(console.error);
