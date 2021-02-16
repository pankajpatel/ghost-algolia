import fetch from 'node-fetch';
import { stringifyUrl } from 'query-string';
import indexFactory from './lib/indexFactory';
import parserFactory from './lib/parserFactory';

exports.handler = async (event, context, callback) => {
  const algoliaSettings = {
    active: process.env.ALGOLIA_ACTIVE === 'TRUE',
    applicationID: process.env.ALGOLIA_APP_ID,
    apiKey: process.env.ALGOLIA_API_KEY,
    index: process.env.ALGOLIA_INDEX,
  };

  const ghost = {
    url: process.env.GHOST_HOST,
    key: process.env.GHOST_KEY,
    version: process.env.GHOST_API_VERSION || 'v3',
  };

  const getUrl = (endpoint, params) => stringifyUrl({
    url: `${ghost.url}/ghost/api/${ghost.version}/content/${endpoint}`,
    query: { ...params, key: ghost.key },
  });
  const url = getUrl('posts/', { include: 'tags,authors', limit: 'all', order: 'published_at desc' });
  console.log(url);
  const posts = await fetch(url)
    .then(r => r.json())
    .then(r => r.posts);

  const index = indexFactory(algoliaSettings);

  const fragments = posts.map(post => parserFactory().parse(post, index));

  const totalFragments = fragments.reduce((total, count) => (total + count), 0);

  console.log({ posts: posts.length, totalFragments, fragments });

  if (index.connect() && totalFragments) {
    index
      .update()
      .then(() => {
        callback(null, {
          statusCode: 200,
          body: 'GhostAlgolia: Posts have been added to the index.',
        });
      })
      .catch((err) => {
        callback(err);
      });
  }

  return {
    statusCode: 500,
    body: 'An error has occurred',
  };

}
