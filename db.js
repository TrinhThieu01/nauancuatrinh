import pg from "pg";
const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) console.warn("DATABASE_URL is not set. Configure it before starting PantryChef.");
export const pool = new Pool({
  connectionString,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.PGPOOL_MAX || 5),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});
export async function query(text, params = []) { return pool.query(text, params); }
export async function initDb() {
  if (!connectionString) throw new Error("Thiếu DATABASE_URL. Hãy cấu hình URL kết nối PostgreSQL trong môi trường triển khai.");
  await query(`
    CREATE TABLE IF NOT EXISTS ingredients (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL DEFAULT 'Khác',
      canonical_unit TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (length(trim(name)) > 0), CHECK (length(trim(canonical_unit)) > 0)
    );
    CREATE TABLE IF NOT EXISTS pantry_items (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT 'local-user',
      ingredient_id BIGINT NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
      quantity NUMERIC(12,3) NOT NULL CHECK (quantity >= 0),
      unit TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Khác',
      expiry_date DATE,
      brand TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CHECK(length(trim(unit)) > 0)
    );
    CREATE TABLE IF NOT EXISTS recipes (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      prep_minutes INTEGER NOT NULL DEFAULT 0 CHECK(prep_minutes >= 0),
      cook_minutes INTEGER NOT NULL DEFAULT 0 CHECK(cook_minutes >= 0),
      servings INTEGER NOT NULL DEFAULT 1 CHECK(servings > 0),
      ingredients_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      steps_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CHECK(length(trim(title)) > 0)
    );
    CREATE TABLE IF NOT EXISTS community_posts (
      id BIGSERIAL PRIMARY KEY,
      author_name TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Chia sẻ kinh nghiệm',
      content TEXT NOT NULL,
      image_url TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (length(trim(author_name)) BETWEEN 1 AND 60),
      CHECK (length(trim(title)) BETWEEN 5 AND 140),
      CHECK (length(trim(content)) BETWEEN 20 AND 10000)
    );
    CREATE TABLE IF NOT EXISTS community_comments (
      id BIGSERIAL PRIMARY KEY,
      post_id BIGINT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
      author_name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (length(trim(author_name)) BETWEEN 1 AND 60),
      CHECK (length(trim(content)) BETWEEN 2 AND 1500)
    );
    CREATE INDEX IF NOT EXISTS idx_community_posts_created ON community_posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_community_comments_post ON community_comments(post_id, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_pantry_user_expiry ON pantry_items(user_id, expiry_date);
    CREATE INDEX IF NOT EXISTS idx_pantry_ingredient ON pantry_items(ingredient_id);
  `);
  // Idempotent starter catalog: safe to run on every application start.
  const starterIngredients = [
    ['Trứng','Đạm','quả'], ['Cà chua','Rau củ','quả'], ['Đậu phụ','Đạm','bìa'],
    ['Hành lá','Rau củ','g'], ['Dầu ăn','Gia vị','ml'], ['Nước mắm','Gia vị','ml'],
    ['Tỏi','Gia vị','tép'], ['Gạo','Tinh bột','g'], ['Thịt heo xay','Thịt','g'],
    ['Rau muống','Rau củ','g'], ['Thịt bò','Thịt','g'], ['Bông cải xanh','Rau củ','g'],
    ['Cà rốt','Rau củ','củ'], ['Khoai tây','Rau củ','củ'], ['Hành tây','Rau củ','củ'],
    ['Mì trứng','Tinh bột','gói'], ['Thịt gà','Thịt','g'], ['Gừng','Gia vị','g'],
    ['Nước tương','Gia vị','ml'], ['Dưa leo','Rau củ','quả'], ['Cá basa','Hải sản','g'],
    ['Chanh','Trái cây','quả'], ['Đường','Gia vị','g'], ['Muối','Gia vị','g'],
    ['Nấm rơm','Rau củ','g'], ['Bún tươi','Tinh bột','g'], ['Sữa tươi','Sữa, chế phẩm','ml']
  ];
  for (const [name, category, unit] of starterIngredients) {
    await query('INSERT INTO ingredients(name,category,canonical_unit) VALUES($1,$2,$3) ON CONFLICT(name) DO NOTHING', [name, category, unit]);
  }
  const ids = Object.fromEntries((await query('SELECT id,name FROM ingredients')).rows.map(x => [x.name, Number(x.id)]));
  const recipe = (name, quantity, unit, required = true) => ({ ingredient_id: ids[name], name, quantity, unit, required });
  const starterRecipes = [
    {
      title: 'Trứng xào cà chua', description: 'Món cơm nhà nhanh gọn, hợp bữa sáng hoặc bữa tối.', prep: 5, cook: 8, servings: 2,
      ingredients: [recipe('Trứng',2,'quả'),recipe('Cà chua',2,'quả'),recipe('Dầu ăn',10,'ml'),recipe('Hành lá',10,'g',false),recipe('Nước mắm',5,'ml',false)],
      steps: ['Rửa cà chua, cắt múi cau; đánh tan trứng.','Làm nóng dầu, xào cà chua đến mềm.','Cho trứng vào đảo chín, nêm chút nước mắm và rắc hành lá.']
    },
    {
      title: 'Đậu phụ sốt cà chua', description: 'Món chay dễ làm, ăn cùng cơm nóng rất hợp.', prep: 7, cook: 12, servings: 2,
      ingredients: [recipe('Đậu phụ',2,'bìa'),recipe('Cà chua',2,'quả'),recipe('Dầu ăn',15,'ml'),recipe('Tỏi',2,'tép',false),recipe('Hành lá',10,'g',false)],
      steps: ['Cắt đậu phụ thành miếng vừa ăn, cà chua cắt múi.','Áp chảo đậu phụ với một ít dầu đến vàng nhẹ.','Phi thơm tỏi, xào cà chua, thêm chút nước rồi cho đậu vào sốt 5–7 phút.','Nêm vừa ăn, rắc hành lá và dùng nóng.']
    },
    {
      title: 'Rau muống xào tỏi', description: 'Món rau quen thuộc, làm nhanh cho bữa cơm gia đình.', prep: 5, cook: 6, servings: 2,
      ingredients: [recipe('Rau muống',300,'g'),recipe('Tỏi',3,'tép'),recipe('Dầu ăn',15,'ml'),recipe('Muối',2,'g',false)],
      steps: ['Nhặt rau muống, rửa sạch và để ráo.','Phi thơm tỏi với dầu ăn.','Cho rau vào xào lửa lớn, nêm chút muối và đảo đến khi rau vừa chín.']
    },
    {
      title: 'Thịt heo băm rang mặn ngọt', description: 'Món mặn đưa cơm, dùng nguyên liệu dễ tìm.', prep: 5, cook: 12, servings: 2,
      ingredients: [recipe('Thịt heo xay',250,'g'),recipe('Nước mắm',15,'ml'),recipe('Đường',8,'g'),recipe('Tỏi',2,'tép'),recipe('Dầu ăn',5,'ml'),recipe('Hành lá',10,'g',false)],
      steps: ['Băm nhỏ tỏi, trộn thịt với một ít nước mắm.','Phi thơm tỏi, cho thịt vào rang tơi.','Thêm phần nước mắm còn lại và đường, đảo đến khi thịt săn và hơi sệt.','Rắc hành lá nếu thích, ăn cùng cơm nóng.']
    },
    {
      title: 'Thịt bò xào bông cải', description: 'Bữa ăn cân bằng, có thịt và rau xanh.', prep: 10, cook: 10, servings: 2,
      ingredients: [recipe('Thịt bò',250,'g'),recipe('Bông cải xanh',250,'g'),recipe('Tỏi',2,'tép'),recipe('Dầu ăn',15,'ml'),recipe('Nước tương',10,'ml')],
      steps: ['Thái thịt bò mỏng; cắt bông cải thành nhánh và rửa sạch.','Chần bông cải 1–2 phút rồi để ráo.','Phi thơm tỏi, xào bò nhanh trên lửa lớn.','Cho bông cải vào, thêm nước tương và đảo đều đến khi vừa chín.']
    },
    {
      title: 'Canh khoai tây cà rốt', description: 'Món canh nhẹ nhàng, dễ kết hợp với bữa cơm.', prep: 10, cook: 20, servings: 3,
      ingredients: [recipe('Khoai tây',2,'củ'),recipe('Cà rốt',1,'củ'),recipe('Hành tây',1,'củ',false),recipe('Muối',3,'g',false)],
      steps: ['Gọt vỏ khoai tây, cà rốt và cắt miếng vừa ăn.','Đun sôi khoảng 800 ml nước, cho khoai tây và cà rốt vào.','Nấu 15–20 phút đến khi rau củ mềm, nêm vừa ăn.']
    },
    {
      title: 'Mì trứng xào rau củ', description: 'Món nhanh gọn cho ngày bận rộn.', prep: 8, cook: 8, servings: 1,
      ingredients: [recipe('Mì trứng',1,'gói'),recipe('Trứng',1,'quả'),recipe('Cà rốt',1,'củ',false),recipe('Nước tương',10,'ml'),recipe('Dầu ăn',10,'ml')],
      steps: ['Luộc mì vừa chín tới rồi để ráo.','Xào cà rốt thái sợi với một ít dầu.','Cho trứng vào đảo chín, thêm mì và nước tương, xào đều.']
    },
    {
      title: 'Gà xào gừng', description: 'Món mặn thơm gừng, ăn nóng cùng cơm.', prep: 10, cook: 15, servings: 2,
      ingredients: [recipe('Thịt gà',300,'g'),recipe('Gừng',15,'g'),recipe('Nước mắm',15,'ml'),recipe('Dầu ăn',10,'ml'),recipe('Đường',5,'g',false)],
      steps: ['Thái gà miếng vừa ăn, gừng thái sợi.','Phi thơm gừng, cho gà vào xào săn.','Nêm nước mắm và chút đường, thêm ít nước rồi đậy nắp nấu chín hoàn toàn.']
    },
    {
      title: 'Bún cá basa sốt cà chua', description: 'Biến tấu bữa trưa với cá và bún tươi.', prep: 10, cook: 15, servings: 2,
      ingredients: [recipe('Cá basa',250,'g'),recipe('Cà chua',2,'quả'),recipe('Bún tươi',400,'g'),recipe('Tỏi',2,'tép',false),recipe('Nước mắm',10,'ml'),recipe('Dầu ăn',10,'ml')],
      steps: ['Cắt cá thành miếng, rửa sạch và thấm khô.','Xào cà chua với dầu và tỏi, thêm một ít nước.','Cho cá vào nấu chín kỹ, nêm nước mắm vừa ăn.','Trụng bún, chan phần sốt cá lên trên và dùng nóng.']
    },
    {
      title: 'Dưa leo trộn chanh', description: 'Món ăn kèm thanh mát, chuẩn bị trong vài phút.', prep: 8, cook: 0, servings: 2,
      ingredients: [recipe('Dưa leo',2,'quả'),recipe('Chanh',1,'quả'),recipe('Đường',5,'g',false),recipe('Muối',1,'g',false)],
      steps: ['Rửa sạch dưa leo, thái lát mỏng.','Vắt chanh, hòa với chút đường và muối.','Trộn đều với dưa leo, để 5 phút rồi dùng.']
    }
  ];
  for (const r of starterRecipes) {
    const exists = await query('SELECT 1 FROM recipes WHERE title=$1 LIMIT 1', [r.title]);
    if (!exists.rowCount) {
      await query(`INSERT INTO recipes(title,description,prep_minutes,cook_minutes,servings,ingredients_json,steps_json)
        VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`,
        [r.title,r.description,r.prep,r.cook,r.servings,JSON.stringify(r.ingredients),JSON.stringify(r.steps)]);
    }
  }
  // Optional demo stock: only populate an entirely empty pantry, so existing user data is never overwritten.
  const pantryCount = Number((await query("SELECT COUNT(*)::int AS n FROM pantry_items WHERE user_id='local-user'")).rows[0].n);
  if (!pantryCount) {
    const demoStock = [
      ['Trứng',6,'quả', 4,'', '6 quả trứng gà'],
      ['Cà chua',4,'quả', 2,'', 'Dùng sớm để tránh hỏng'],
      ['Đậu phụ',2,'bìa', 1,'', 'Bảo quản ngăn mát'],
      ['Hành lá',50,'g', 2,'', ''],
      ['Rau muống',300,'g', 1,'', ''],
      ['Thịt heo xay',250,'g', 3,'', 'Bảo quản lạnh'],
      ['Gạo',1000,'g', null,'', 'Gạo tẻ'],
      ['Tỏi',10,'tép', null,'', '']
    ];
    for (const [name, quantity, unit, expiry, brand, notes] of demoStock) {
      if (ids[name]) await query(`INSERT INTO pantry_items(user_id,ingredient_id,quantity,unit,category,expiry_date,brand,notes)
        VALUES('local-user',$1,$2,$3,(SELECT category FROM ingredients WHERE id=$1),CASE WHEN $4::int IS NULL THEN NULL ELSE CURRENT_DATE + $4::int END,$5,$6)`,
        [ids[name],quantity,unit,expiry,brand,notes]);
    }
  }
}
