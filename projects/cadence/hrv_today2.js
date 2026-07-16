const { MongoClient } = require('mongodb');
const fs = require('fs');
const URI = fs.readFileSync('/home2/cleo/mongo_uri', 'utf8').trim();

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db('cadence-dev');

  const cols = await db.listCollections().toArray();
  const colNames = cols.map(c => c.name);
  console.log('Collections:', colNames.join(', '));

  // Find which collection has recent WHOOP data
  for (const name of colNames) {
    const col = db.collection(name);
    const count = await col.countDocuments();
    if (count === 0) continue;
    const doc = await col.findOne({}, { sort: { _id: -1 } });
    // Look for HRV-like fields
    const str = JSON.stringify(doc);
    if (str.includes('hrv') || str.includes('HRV') || str.includes('recovery') || str.includes('rmssd')) {
      console.log(`\n[${name}] count=${count} latest:`);
      console.log(JSON.stringify(doc, null, 2).slice(0, 800));
    }
  }

  await client.close();
}
main().catch(e => console.error(e));
