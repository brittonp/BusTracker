export default async function (context, req) {
  context.res = {
    body: {
      apiBaseUrl: process.env.API_BASE_URL || '.',
    },
  };
}
