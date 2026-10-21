import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname || path.dirname(new URL(import.meta.url).pathname), '..');
test('project uses PostgreSQL driver and does not include SQLite dependency', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.ok(pkg.dependencies.pg, 'pg dependency should be present');
  assert.equal(pkg.dependencies['better-sqlite3'], undefined);
});
test('database configuration documents DATABASE_URL', () => {
  const env = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
  const db = fs.readFileSync(path.join(root, 'src/db.js'), 'utf8');
  assert.match(env, /DATABASE_URL=/);
  assert.match(db, /process\.env\.DATABASE_URL/);
});
test('UI contains requested inventory fields and filters', () => {
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  for (const id of ['category', 'expiry', 'brand', 'image_url', 'notes', 'search', 'category-filter', 'expiry-filter']) {
    assert.ok(html.includes(`id="${id}"`), `missing UI field: ${id}`);
  }
  assert.match(html, /adjustQty/);
  assert.match(html, /cookRecipe/);
});
test('backend exposes core pantry and recipe workflows', () => {
  const server = fs.readFileSync(path.join(root, 'src/server.js'), 'utf8');
  for (const route of ["'/pantry'", "'/ingredients'", "'/recipes'", "'/suggestions'", "'/recipes/:id/cook'"]) {
    assert.ok(server.includes(route), `missing API route: ${route}`);
  }
});

test('Vietnamese UI source is UTF-8 NFC and avoids escaped byte text', () => {
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  assert.equal(html, html.normalize('NFC'));
  assert.doesNotMatch(html, /\\x(?:[0-9a-fA-F]{2})/);
  assert.match(html, /Kho thực phẩm của bạn/);
  assert.match(html, /Xóa bộ lọc/);
  assert.match(html, /quantity-dialog/);
});

test('community blog UI and API routes exist', () => {
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const server = fs.readFileSync(path.join(root, 'src/server.js'), 'utf8');
  const db = fs.readFileSync(path.join(root, 'src/db.js'), 'utf8');
  assert.match(html, /Góc bếp cộng đồng/);
  assert.match(html, /community-post-form/);
  assert.match(server, /\/community\/posts/);
  assert.match(server, /\/comments/);
  assert.match(db, /CREATE TABLE IF NOT EXISTS community_posts/);
  assert.match(db, /CREATE TABLE IF NOT EXISTS community_comments/);
});


test('starter catalog contains useful Vietnamese ingredients and recipes', () => {
  const db = fs.readFileSync(path.join(root, 'src/db.js'), 'utf8');
  for (const name of ['Rau muống','Thịt heo xay','Bông cải xanh','Mì trứng','Cá basa']) assert.ok(db.includes(name), `missing starter ingredient: ${name}`);
  for (const name of ['Trứng xào cà chua','Rau muống xào tỏi','Gà xào gừng','Bún cá basa sốt cà chua']) assert.ok(db.includes(name), `missing starter recipe: ${name}`);
  assert.match(db, /ON CONFLICT\(name\) DO NOTHING/);
  assert.match(db, /CURRENT_DATE \+ \$4::int/);
});

test('unit fields offer common Vietnamese household and cooking units', () => {
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  for (const unit of ['quả', 'g', 'kg', 'gói', 'bó', 'ml', 'lít', 'bìa', 'hộp', 'chai', 'lon', 'túi', 'miếng', 'lát', 'nhánh', 'cây', 'con', 'vỉ', 'nắm']) {
    assert.ok(html.includes(`value="${unit}"`), `unit ${unit} should be available`);
  }
  assert.match(html, /<select id="unit"/);
  assert.match(html, /<select id="edit-unit"/);
});

test('photo fields support phone camera, gallery selection, and compressed local images', () => {
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const server = fs.readFileSync(path.join(root, 'src/server.js'), 'utf8');
  for (const id of ['camera-image-input', 'gallery-image-input', 'edit-camera-input', 'edit-gallery-input', 'post-camera-input', 'post-gallery-input']) assert.ok(html.includes(`id="${id}"`), `missing photo picker: ${id}`);
  assert.match(html, /capture="environment"/);
  assert.match(html, /compressImageFile/);
  assert.match(server, /data:image\\\//);
  assert.match(server, /express\.json\(\{limit:'6mb'\}\)/);
});
