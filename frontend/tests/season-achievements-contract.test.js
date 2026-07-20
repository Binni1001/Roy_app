import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function read(path) {
  return readFileSync(path, 'utf8')
}

test('user and admin arenas share the season achievements component', () => {
  const userArena = read('src/features/user/PkArena.jsx')
  const adminArena = read('src/features/admin/panels/PkPanel.jsx')
  const component = read('src/components/SeasonAchievements.jsx')

  assert.match(userArena, /<SeasonAchievements achievements=\{achievements\}/)
  assert.match(adminArena, /<SeasonAchievements achievements=\{achievements\}/)
  assert.match(userArena, /api\.pk\.arena\(periodId\)/)
  assert.match(adminArena, /api\.pk\.arena\(periodId\)/)
  assert.match(component, /Năng nổ/)
  assert.match(component, /Chuỗi thắng/)
  assert.match(component, /Chơi nhiều nhất/)
});

test('arena API requests achievements in the existing matches call', () => {
  const client = read('src/api/client.js')
  assert.match(client, /arena: \(periodId\)/)
  assert.match(client, /include_achievements: 'true'/)
});
