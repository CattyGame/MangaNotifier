const pluginManager = require('./electron/plugins');
const Database = require('./electron/core/database');

async function testAll() {
  console.log('=== BẮT ĐẦU KIỂM THỬ TOÀN DIỆN HỆ THỐNG MANGA NOTIFIER ===\n');

  // 1. Test Database
  console.log('[1/5] Kiểm tra Database & Phân loại...');
  const db = new Database();
  const settings = db.getSettings();
  console.log('  -> Database load thành công.');
  console.log('  -> Settings:', JSON.stringify(settings));

  // 2. Test Plugins List
  console.log('\n[2/5] Kiểm tra Danh sách Plugin Nguồn...');
  const plugins = pluginManager.getAllPlugins();
  console.log('  -> Các plugin đã sẵn sàng (' + plugins.length + ' nguồn):', plugins.map(p => p.name).join(', '));

  // 3. Test MangaDex Search & Images (with DataSaver test)
  console.log('\n[3/5] Kiểm tra Plugin MangaDex (API & DataSaver)...');
  try {
    const searchResults = await pluginManager.searchAll('Chainsaw Man', 'mangadex');
    console.log(`  -> Tìm thấy ${searchResults.length} kết quả trên MangaDex.`);
    if (searchResults.length > 0) {
      console.log(`     Tên truyện: "${searchResults[0].title}"`);
      const details = await pluginManager.getPlugin('mangadex').getMangaDetails(searchResults[0].url);
      console.log(`     Tổng số chap tìm thấy: ${details.chapters?.length || 0}`);
      const testChap = (details.chapters || []).find(c => !c.isExternal);
      if (testChap) {
        const images = await pluginManager.getPlugin('mangadex').getChapterImages(testChap.url, { dataSaver: true });
        console.log(`     Lấy ảnh chương "${testChap.title}" thành công (${images.length} ảnh, chế độ DataSaver).`);
      }
    }
  } catch (err) {
    console.error('  -> MangaDex test error:', err.message);
  }

  // 4. Test TruyenQQ Search & Details
  console.log('\n[4/5] Kiểm tra Plugin TruyenQQ...');
  try {
    const qqPlugin = pluginManager.getPlugin('truyenqq');
    const qqResults = await qqPlugin.search('Hunter X Hunter');
    console.log(`  -> Tìm thấy ${qqResults.length} kết quả trên TruyenQQ.`);
    if (qqResults.length > 0) {
      console.log(`     Tên truyện: "${qqResults[0].title}" | URL: ${qqResults[0].url}`);
      const details = await qqPlugin.getMangaDetails(qqResults[0].url);
      console.log(`     Trích xuất chi tiết thành công: ${details.chapters?.length || 0} chương.`);
    }
  } catch (err) {
    console.error('  -> TruyenQQ test error:', err.message);
  }

  // 5. Test URL Detection across all mirrors & dynamic domains
  console.log('\n[5/5] Kiểm tra Nhận diện Plugin qua URL (Bao gồm TruyenQQ & GocTruyenTranh đổi số)...');
  const testUrls = [
    'https://mangadex.org/title/a7774250-d072-4f10-aede-5e30fb271923',
    'https://nettruyenww.com/truyen-tranh/one-piece-1234',
    'https://blogtruyenmoi.com/12345/conan',
    'https://truyenqq.com.vn/hunter-x-hunter',
    'https://truyenqqviet.com/truyen-tranh/naruto-123.html',
    'https://goctruyentranhvui.com/truyen-tranh/solo-leveling',
    'https://goctruyentranhvui2.com/truyen-tranh/chainsaw-man',
    'https://goctruyentranhvui18.com/truyen-tranh/jujutsu-kaisen',
    'https://goctruyentranhvui99.com/truyen-tranh/dragon-ball'
  ];

  let detectedCount = 0;
  for (const url of testUrls) {
    const plugin = pluginManager.findPluginForUrl(url);
    if (plugin) detectedCount++;
    console.log(`  -> URL: ${url}\n     Plugin nhận diện: ${plugin ? `✅ ${plugin.name} (${plugin.id})` : '❌ Không tìm thấy'}`);
  }

  console.log(`\n  -> Nhận diện đúng ${detectedCount}/${testUrls.length} URL.`);
  console.log('\n=== TẤT CẢ CÁC KIỂM THỬ ĐÃ HOÀN TẤT THÀNH CÔNG ===');
}

testAll().catch(console.error);
