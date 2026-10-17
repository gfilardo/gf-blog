import nunjucks from 'nunjucks';
export function templates(directory) {
  return new nunjucks.Environment(new nunjucks.FileSystemLoader(directory, { noCache: true }), { autoescape: true, throwOnUndefined: true });
}
