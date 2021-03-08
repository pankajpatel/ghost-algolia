import fetch from 'node-fetch';
import { stringifyUrl } from 'query-string';
import IndexFactory from '@tryghost/algolia-indexer';
import transforms from '@tryghost/algolia-fragmenter';

exports.handler = async (event) => {
  if (!process.env.ALGOLIA_ACTIVE === 'TRUE') {
    return {
      statusCode: 200,
      body: 'Algolia is not activated',
    };
  }
  if (process.env.BULK_IMPORT_IN_PROGRESS !== 'TRUE') {
    return {
      statusCode: 200,
      body: 'Bulk Import Finished',
    };
  }

  const algoliaSettings = {
    appId: process.env.ALGOLIA_APP_ID,
    apiKey: process.env.ALGOLIA_API_KEY,
    index: process.env.ALGOLIA_INDEX,
  };

  const ghost = {
    url: process.env.GHOST_HOST,
    key: process.env.GHOST_KEY,
    version: process.env.GHOST_API_VERSION || 'v3',
  };

  const qs = event.queryStringParameters;

  const getUrl = (endpoint, params) => stringifyUrl({
    url: `${ghost.url}/ghost/api/${ghost.version}/content/${endpoint}`,
    query: { ...params, key: ghost.key },
  });
  const url = getUrl(
    'posts/',
    {
      include: 'tags,authors', limit: 'all', order: 'published_at desc', ...qs,
    },
  );
  console.log(url);
  const posts = await fetch(url)
    .then((r) => r.json())
    .then((r) => r.posts);

  console.log(posts.length);

  // Transformer methods need an Array of Objects
  const node = [].concat(posts);

  // Transform into Algolia object with the properties we need
  const algoliaObject = transforms.transformToAlgoliaObject(node);

  // Create fragments of the post
  const fragments = algoliaObject
    .reduce(transforms.fragmentTransformer, [])
    .map((item) => {
      const post = item;
      delete post.html;
      return post;
    });

  try {
    // Instanciate the Algolia indexer, which connects to Algolia and
    // sets up the settings for the index.
    const index = new IndexFactory(algoliaSettings);
    await index.setSettingsForIndex();
    await index.save(fragments);
    console.log('Fragments successfully saved to Algolia index'); // eslint-disable-line no-console
    return {
      statusCode: 200,
      body: 'Posts has been added to the index.',
    };
  } catch (error) {
    console.log(error); // eslint-disable-line no-console
    return {
      statusCode: 500,
      body: JSON.stringify({ msg: error.message }),
    };
  }
};
