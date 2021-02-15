import GhostContentAPI from '@tryghost/content-api';
import indexFactory from './lib/indexFactory';
import parserFactory from './lib/parserFactory';

exports.handler = async (event, context, callback) => {
  const algoliaSettings = {
    active: process.env.ALGOLIA_ACTIVE === 'TRUE',
    applicationID: process.env.ALGOLIA_APP_ID,
    apiKey: process.env.ALGOLIA_API_KEY,
    index: process.env.ALGOLIA_INDEX,
  };

  const api = new GhostContentAPI({
    host: process.env.GHOST_HOST,
    key: process.env.GHOST_KEY,
    version: process.env.GHOST_API_VERSION || 'v3',
  });

  const posts = await api.posts.browse({ include: 'tags,authors' });

  // const post = JSON.parse(event.body).post.current;
  const index = indexFactory(algoliaSettings);

  const fragments = posts.map(post => parserFactory().parse(post, index));

  const totalFragments = fragments.reduce((total, count) => (total + count), 0);

  console.log({ totalFragments, fragments });

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
};
