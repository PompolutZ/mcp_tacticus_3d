-- Measures what TTS's own die roll() does, for docs/feature-dice-rolling.md ("Measurements",
-- "In TTS"). Not run yet: there is no TTS install where it was written. It uses only documented TTS
-- API (spawnObject, Object.roll/resting/getVelocity/getAngularVelocity, Physics.getGravity,
-- Time.time, Time.fixed_delta_time, startLuaCoroutine, Notes.addNotebookTab).
--
-- How to use:
-- 1. Load the mod (3036795456) in TTS. The "Blue Dice Tray" is in the save, so it is on the table.
-- 2. Put any object on the table, for example a block (Objects > Components > Blocks).
-- 3. Right-click it > Scripting > Scripting Editor. Paste this file into the block's tab (not
--    Global) and click "Save & Play". A "Measure dice" button appears on the block.
-- 4. Click the button. It takes a few minutes. Do not touch the Blue tray while it runs.
-- 5. A short summary appears in chat. The full results, with one line per roll, are in the
--    Notebook, tab "Dice measurement", where they can be copied.
--
-- It spawns its own dice in the same way as the tray script (Custom_Dice type 2, the tray's scale,
-- bounciness 0.8, world y = 6 over the well), and deletes them. It does not change the tray, its
-- dice or the mod's scripts. Units: TTS units (inches), seconds, radians.
--
-- What it measures:
-- - TTS settings: gravity, physics step, and the die's mass, drag, friction and bounciness.
-- - ROLL_COUNT rolls of one die that rests in the well: the highest upward speed and spin in the
--   first START_FRAMES frames after roll(), the height jump in the first frame (roll() may lift the
--   die), the highest point above the rest height, and the time until the die rests again.
-- - ROUNDS rounds of ROUND_DICE dice rolled at once, as the Roll button does: the time until all
--   of them rest. The app aims at about 3 s for 10 dice.
-- - For both: how many dice rest off the well floor (on the shelf, the rim, the table or on top of
--   another die), from the rest height.
-- - Gravity again, from the speed of a die that falls freely.
-- - RAPID_RUNS runs of roll() on every frame, like a player who presses Roll very fast: the height
--   of the die just before each new throw. In TTS the die seems to be thrown again only when it
--   falls back to one height, as if it bounced on an invisible floor. The app's ROLL_HEIGHT_LIMIT
--   (src/dice/tray.js) is this height. Also how often the spin changes without a new throw: in TTS
--   each press seems to change the spin of a die above that height.

local TRAY_NICKNAME = "Blue Dice Tray"
local DIE_IMAGE_URL = "https://steamusercontent-a.akamaihd.net/ugc/783003963486280633/F22C6421CD6DAA09A14F7AB7AF380AFF2DC90480/"
local ANGLE_OFFSET = -1 -- the tray script's angleOffset for the Blue tray
local SPAWN_Y = 6 -- the tray script spawns dice at world y = 6
local ROLL_COUNT = 30
local ROUNDS = 5
local ROUND_DICE = 10
local START_FRAMES = 5 -- frames after roll() to read the start speed and spin from
local DROP_HEIGHT = 4.8 -- the free fall test, above the rest height; the app's DROP_HEIGHT
local OFF_FLOOR = 0.3 -- a die that rests this much above or below the well floor rest height is off it
local TIMEOUT = 20 -- seconds; stop waiting for a die to rest after this
local RAPID_RUNS = 3
local RAPID_SECONDS = 6
local RETHROW_SPEED_JUMP = 5 -- in/s; a bigger rise of the upward speed in one frame is a new throw
local RETHROW_LIFT_JUMP = 0.5 -- in; a bigger rise of the height in one frame is a new throw (roll() may lift the die)
local SPIN_JUMP = 3 -- rad/s; a bigger change of the spin in one frame, without a new throw, is a new spin

local busy = false
local tray = nil
local center = nil
local summary = {} -- lines for chat and the notebook
local details = {} -- lines for the notebook only
local wellRestY = nil -- rest height of a die on the well floor, from the first rest

function onLoad()
  self.createButton({
    click_function = "onMeasureClick",
    function_owner = self,
    label = "Measure dice",
    position = { 0, 1, 0 },
    width = 1800,
    height = 400,
    font_size = 200,
  })
end

function onMeasureClick()
  if busy then return end
  tray = findTray()
  if tray == nil then
    broadcastToAll("No object named \"" .. TRAY_NICKNAME .. "\" on the table.", { 1, 0.3, 0.3 })
    return
  end
  busy = true
  center = tray.getPosition()
  summary = {}
  details = {}
  wellRestY = nil
  broadcastToAll("Measuring dice. This takes a few minutes.", { 1, 1, 1 })
  startLuaCoroutine(self, "measureAll")
end

function measureAll()
  measureSettingsAndGravity()
  measureRolls()
  measureRounds()
  measureRapidRolls()
  for _, line in ipairs(summary) do print(line) end
  local body = table.concat(summary, "\n") .. "\n\n" .. table.concat(details, "\n")
  Notes.addNotebookTab({ title = "Dice measurement", body = body })
  broadcastToAll("Dice measurement done. Full results: Notebook, tab \"Dice measurement\".", { 1, 1, 1 })
  busy = false
  return 1
end

function findTray()
  for _, obj in ipairs(getObjects()) do
    if obj.getName() == TRAY_NICKNAME then return obj end
  end
  return nil
end

-- Spawns a die in the same way as the tray script's addDice().
function spawnDie(x, z)
  local die = spawnObject({
    type = "Custom_Dice",
    position = { x, SPAWN_Y, z },
    rotation = { math.random(0, 360), math.random(0, 360), math.random(0, 360) },
    scale = tray.getScale(),
    sound = false,
  })
  die.setCustomObject({ image = DIE_IMAGE_URL, type = 2 })
  die.sticky = false
  die.use_grid = false
  die.use_snap_points = false
  die.bounciness = 0.8
  die.interactable = false
  return die
end

-- A random spawn point, the same as the tray script's addDice().
function spawnDieInWell()
  return spawnDie(center.x + math.random(-3, 3), center.z + math.random(-3, 3) + ANGLE_OFFSET)
end

function waitFrames(n)
  for _ = 1, n do coroutine.yield(0) end
end

-- Waits until check() returns true. Returns the seconds waited, or nil after TIMEOUT seconds.
function waitUntil(check)
  local start = Time.time
  while not check() do
    if Time.time - start > TIMEOUT then return nil end
    coroutine.yield(0)
  end
  return Time.time - start
end

-- Waits until every die in `dice` rests. Returns the seconds waited, or nil after TIMEOUT.
function waitAllResting(dice)
  return waitUntil(function()
    for _, die in ipairs(dice) do
      if not die.resting then return false end
    end
    return true
  end)
end

-- A new die is awake, but give it a few frames so `resting` cannot be read too early.
function spawnAndSettle(count)
  local dice = {}
  for i = 1, count do dice[i] = spawnDieInWell() end
  waitFrames(10)
  waitAllResting(dice)
  return dice
end

function isOffFloor(die)
  return math.abs(die.getPosition().y - wellRestY) > OFF_FLOOR
end

function vecLength(v)
  return math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
end

function stats(values)
  if #values == 0 then return "no data" end
  local sum, low, high = 0, math.huge, -math.huge
  for _, v in ipairs(values) do
    sum = sum + v
    low = math.min(low, v)
    high = math.max(high, v)
  end
  return string.format("min %.2f, avg %.2f, max %.2f", low, sum / #values, high)
end

function report(text)
  table.insert(summary, text)
end

function measureSettingsAndGravity()
  local die = spawnAndSettle(1)[1]
  wellRestY = die.getPosition().y
  report(string.format("Physics step: %.4f s (%.0f Hz)", Time.fixed_delta_time, 1 / Time.fixed_delta_time))
  local g = Physics.getGravity()
  report(string.format("Physics.getGravity(): %.2f, %.2f, %.2f", g.x, g.y, g.z))
  report(string.format(
    "Die: mass %.2f, drag %.2f, angular drag %.2f, bounciness %.2f, static friction %.2f, dynamic friction %.2f",
    die.mass, die.drag, die.angular_drag, die.bounciness, die.static_friction, die.dynamic_friction
  ))
  report(string.format("Die rest height on the well floor: y %.3f (tray y %.3f)", wellRestY, center.y))

  -- Free fall: gravity from the change of the downward speed, between a sample a few frames after
  -- the release and the last sample while the die is still at least 1" above the floor.
  local p = die.getPosition()
  die.setPosition({ p.x, wellRestY + DROP_HEIGHT, p.z })
  -- A resting body can stay asleep after setPosition. A small speed wakes it.
  die.setVelocity({ 0, -0.01, 0 })
  die.setAngularVelocity({ 0, 0, 0 })
  waitFrames(3)
  local t1, v1 = Time.time, die.getVelocity().y
  local t2, v2 = t1, v1
  while die.getPosition().y > wellRestY + 1 and Time.time - t1 < TIMEOUT do
    coroutine.yield(0)
    t2, v2 = Time.time, die.getVelocity().y
  end
  if t2 > t1 then
    report(string.format("Free fall: gravity %.1f in/s^2 (from %.2f s of fall)", (v1 - v2) / (t2 - t1), t2 - t1))
  else
    report("Free fall: no data (the die did not fall)")
  end
  die.destruct()
  waitFrames(2)
end

function measureRolls()
  local upSpeeds, spins, lifts, heights, restTimes = {}, {}, {}, {}, {}
  local offFloor, timeouts = 0, 0
  table.insert(details, "Rolls of one die: up speed, spin, first-frame lift, highest point, rest time, off floor")
  for i = 1, ROLL_COUNT do
    local die = spawnAndSettle(1)[1]
    local restY = die.getPosition().y
    local rollTime = Time.time
    die.roll()
    local upSpeed, spin, highest, lift = 0, 0, restY, nil
    for _ = 1, START_FRAMES do
      coroutine.yield(0)
      local y = die.getPosition().y
      if lift == nil then lift = y - restY end
      highest = math.max(highest, y)
      upSpeed = math.max(upSpeed, die.getVelocity().y)
      spin = math.max(spin, vecLength(die.getAngularVelocity()))
    end
    local rested = waitUntil(function()
      highest = math.max(highest, die.getPosition().y)
      return die.resting
    end)
    if rested == nil then
      timeouts = timeouts + 1
      table.insert(details, string.format("%d: did not rest in %d s", i, TIMEOUT))
    else
      local restTime = Time.time - rollTime
      local off = isOffFloor(die)
      if off then offFloor = offFloor + 1 end
      table.insert(upSpeeds, upSpeed)
      table.insert(spins, spin)
      table.insert(lifts, lift)
      table.insert(heights, highest - restY)
      table.insert(restTimes, restTime)
      table.insert(details, string.format("%d: %.2f, %.2f, %.2f, %.2f, %.2f, %s",
        i, upSpeed, spin, lift, highest - restY, restTime, off and "yes" or "no"))
    end
    die.destruct()
    waitFrames(2)
  end
  report(string.format("%d rolls of one die:", ROLL_COUNT))
  report("  up speed in/s: " .. stats(upSpeeds))
  report("  spin rad/s: " .. stats(spins))
  report("  first-frame lift in: " .. stats(lifts))
  report("  highest point above rest in: " .. stats(heights))
  report("  rest time s: " .. stats(restTimes))
  report(string.format("  off the well floor: %d, did not rest: %d", offFloor, timeouts))
end

function measureRounds()
  local restTimes = {}
  local offFloor, timeouts = 0, 0
  table.insert(details, "")
  table.insert(details, string.format("Rounds of %d dice: rest time of all, dice off floor", ROUND_DICE))
  for round = 1, ROUNDS do
    local dice = spawnAndSettle(ROUND_DICE)
    local rollTime = Time.time
    for _, die in ipairs(dice) do die.roll() end
    waitFrames(START_FRAMES)
    local rested = waitAllResting(dice)
    if rested == nil then
      timeouts = timeouts + 1
      table.insert(details, string.format("%d: did not rest in %d s", round, TIMEOUT))
    else
      local off = 0
      for _, die in ipairs(dice) do
        if isOffFloor(die) then off = off + 1 end
      end
      offFloor = offFloor + off
      table.insert(restTimes, Time.time - rollTime)
      table.insert(details, string.format("%d: %.2f, %d", round, Time.time - rollTime, off))
    end
    for _, die in ipairs(dice) do die.destruct() end
    waitFrames(2)
  end
  report(string.format("%d rounds of %d dice:", ROUNDS, ROUND_DICE))
  report("  rest time of all s: " .. stats(restTimes))
  report(string.format("  dice off the well floor: %d of %d, rounds that did not rest: %d",
    offFloor, ROUNDS * ROUND_DICE, timeouts))
end

function measureRapidRolls()
  local heights = {}
  local spinChanges = 0
  local seconds = 0
  table.insert(details, "")
  table.insert(details, "Rapid rolls: height above rest just before each new throw")
  for run = 1, RAPID_RUNS do
    local die = spawnAndSettle(1)[1]
    local restY = die.getPosition().y
    local prevY, prevVy = restY, 0
    local prevSpin = { x = 0, y = 0, z = 0 }
    local runHeights = {}
    local start = Time.time
    while Time.time - start < RAPID_SECONDS do
      die.roll()
      coroutine.yield(0)
      local y = die.getPosition().y
      local vy = die.getVelocity().y
      local spin = die.getAngularVelocity()
      local spinJump = vecLength({ x = spin.x - prevSpin.x, y = spin.y - prevSpin.y, z = spin.z - prevSpin.z })
      -- A bounce on the tray floor also raises the upward speed and changes the spin, so only
      -- changes above the floor count
      if prevY - restY > OFF_FLOOR then
        if vy - prevVy > RETHROW_SPEED_JUMP or y - prevY > RETHROW_LIFT_JUMP then
          table.insert(heights, prevY - restY)
          table.insert(runHeights, string.format("%.2f", prevY - restY))
        elseif spinJump > SPIN_JUMP then
          spinChanges = spinChanges + 1
        end
      end
      prevY, prevVy, prevSpin = y, vy, spin
    end
    seconds = seconds + (Time.time - start)
    table.insert(details, string.format("%d: %s", run, table.concat(runHeights, ", ")))
    die.destruct()
    waitFrames(2)
  end
  report(string.format("Rapid rolls (roll() on every frame, %d x %d s):", RAPID_RUNS, RAPID_SECONDS))
  report("  height above rest just before a new throw in: " .. stats(heights))
  report(string.format("  new throws above the floor per second: %.1f", #heights / seconds))
  report(string.format("  spin changes without a new throw per second: %.1f", spinChanges / seconds))
end
