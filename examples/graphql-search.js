/**
 * GraphQL search example.
 *
 * Install dependencies first:
 *   npm install graphql @graphql-yoga/node
 *
 * Start:
 *   node examples/graphql-search.js
 */

const { createServer } = require('@graphql-yoga/node');
const { FaissIndex, normalizeVectors } = require('../src/js');

const dims = 4;
const index = new FaissIndex({ type: 'FLAT_IP', dims });

async function seed() {
  const vectors = normalizeVectors(new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
  ]), dims);

  await index.add(vectors);
}

const typeDefs = /* GraphQL */ `
  type SearchResult {
    label: Int!
    score: Float!
  }

  type Query {
    search(query: [Float!]!, k: Int = 5): [SearchResult!]!
    info: String!
  }
`;

const resolvers = {
  Query: {
    async search(_, args) {
      const query = normalizeVectors(new Float32Array(args.query), dims);
      const results = await index.search(query, args.k);
      return Array.from(results.labels).map((label, i) => ({
        label,
        score: results.distances[i],
      }));
    },
    info() {
      return index.inspect({ format: 'text' });
    },
  },
};

seed()
  .then(() => {
    const server = createServer({ schema: { typeDefs, resolvers } });
    server.start(() => {
      console.log('GraphQL server listening on http://localhost:4000/graphql');
    });
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
