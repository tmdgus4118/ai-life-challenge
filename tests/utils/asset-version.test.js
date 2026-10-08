const fs = require('fs');
const path = require('path');
const { AssetVersion } = require('../../src/utils/asset-version');
const { makeTempDbDir, removeDir } = require('../helpers');

describe('AssetVersion', () => {
  let dir;
  beforeEach(() => {
    dir = makeTempDbDir();
    fs.mkdirSync(path.join(dir, 'js'));
    fs.writeFileSync(path.join(dir, 'js', 'a.js'), 'console.log(1)');
    fs.writeFileSync(path.join(dir, 'style.css'), 'body{}');
    fs.writeFileSync(path.join(dir, 'note.txt'), 'ignored');
  });
  afterEach(() => removeDir(dir));

  test('compute: 같은 내용이면 같은 값, 내용이 바뀌면 다른 값, 접두어 포함', () => {
    const v1 = AssetVersion.compute([dir], '1.0.0');
    expect(v1).toMatch(/^1\.0\.0-[0-9a-f]{8}$/);
    expect(AssetVersion.compute([dir], '1.0.0')).toBe(v1);
    fs.writeFileSync(path.join(dir, 'js', 'a.js'), 'console.log(2)');
    expect(AssetVersion.compute([dir], '1.0.0')).not.toBe(v1);
  });
  test('compute: 해시 대상이 아닌 파일은 무시, 없는 폴더는 건너뜀', () => {
    const v1 = AssetVersion.compute([dir, path.join(dir, 'missing')]);
    fs.writeFileSync(path.join(dir, 'note.txt'), 'changed');
    expect(AssetVersion.compute([dir])).toBe(v1);
    expect(v1).toMatch(/^[0-9a-f]{8}$/);
  });
  test('listFiles: 하위 폴더까지 정렬해서 / 실패: 빈 목록', () => {
    expect(AssetVersion.listFiles(dir).map((f) => path.basename(f))).toEqual(['a.js', 'style.css']);
    expect(() => AssetVersion.compute([])).toThrow(TypeError);
  });
});
