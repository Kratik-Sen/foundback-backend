const targetUri = process.env.FOUNDBACK_TARGET_MONGODB_URI;
const targetDatabaseName = process.env.FOUNDBACK_TARGET_DATABASE || db.getName();

if (!targetUri) throw new Error('FOUNDBACK_TARGET_MONGODB_URI is required');

const targetConnection = new Mongo(targetUri);
const targetDatabase = targetConnection.getDB(targetDatabaseName);
const collections = db.getCollectionInfos({ type: 'collection' })
  .map((entry) => entry.name)
  .filter((name) => !name.startsWith('system.'));
const report = [];

for (const collectionName of collections) {
  const sourceCollection = db.getCollection(collectionName);
  const targetCollection = targetDatabase.getCollection(collectionName);
  const documents = sourceCollection.find({}).toArray();
  let matched = 0;
  let modified = 0;
  let upserted = 0;

  for (let index = 0; index < documents.length; index += 500) {
    const batch = documents.slice(index, index + 500);
    if (!batch.length) continue;
    const result = targetCollection.bulkWrite(
      batch.map((document) => ({
        replaceOne: {
          filter: { _id: document._id },
          replacement: document,
          upsert: true,
        },
      })),
      { ordered: false },
    );
    matched += result.matchedCount;
    modified += result.modifiedCount;
    upserted += result.upsertedCount;
  }

  report.push({
    collection: collectionName,
    source: documents.length,
    target: targetCollection.countDocuments({}),
    matched,
    modified,
    upserted,
  });
}

print(JSON.stringify({ sourceDatabase: db.getName(), targetDatabase: targetDatabaseName, collections: report }, null, 2));
