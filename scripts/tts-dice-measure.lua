-- Measures what TTS's own die roll() does, for docs/feature-dice-rolling.md ("Measurements",
-- "In TTS"). First run on 2026-10-01; the results are in that doc. It uses only documented TTS
-- API (spawnObject, Object.roll/resting/getVelocity/getAngularVelocity, Physics.getGravity,
-- Time.time, Time.fixed_delta_time, startLuaCoroutine, Notes.addNotebookTab).
--
-- How to use:
-- 1. Run `npm run tts-dice-measure`. It writes the TTS Saved Object "Dice measure": a red block
--    with this file as its script (scripts/tts-dice-measure-object.mjs).
-- 2. Load the mod (3036795456) in TTS. The "Blue Dice Tray" is in the save, so it is on the table.
--    The Workshop mod is fine: nothing is saved.
-- 3. Objects > Saved Objects > "Dice measure". The block appears and its script runs at once. Chat
--    shows "Dice measure script loaded", and a "Measure dice" button appears on the block.
--    Do not paste this file into an object and press Save & Play: on 2026-10-01 the game reloaded
--    without the block, so the script never ran.
-- 4. Click the button, or right-click the block > "Measure dice". It takes a few minutes. Do not
--    touch the Blue tray while it runs.
-- 5. A short summary appears in chat. The full results, with one line per roll, are in the
--    Notebook, tab "Dice measurement", where they can be copied.
--
-- It spawns its own dice in the same way as the tray script (Custom_Dice type 2, the tray's scale,
-- bounciness 0.8, world y = 6 over the well), and deletes them. It does not change the tray, its
-- dice or the mod's scripts. Units: TTS units (inches), seconds, radians.
--
-- What it measures:
-- - TTS settings: gravity, physics step, the die's mass, drag, friction and bounciness, and the
--   tray's friction and bounciness (added after the first run).
-- - ROLL_COUNT rolls of one die that rests in the well: the highest upward speed and spin in the
--   first START_FRAMES frames after roll(), the height jump in the first frame (roll() may lift the
--   die), the highest point above the rest height, and the time until the die rests again. Also
--   the spin during the whole roll, in the flight and in the bounces, from getAngularVelocity() and
--   from the change of the rotation (added after the first run, which read only 7.7-11 rad/s in
--   the first frames, while TTS dice look like they spin much faster).
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
local LANDING_JUMP = 1 -- in/s; a bigger rise of the upward speed in one frame, while the die falls, is a bounce
local SNAP_FRAMES = 2 -- frames after roll() left out of the flight turn speed (roll() snaps the rotation)

local busy = false
local tray = nil
local center = nil
local summary = {} -- lines for chat and the notebook
local details = {} -- lines for the notebook only
local wellRestY = nil -- rest height of a die on the well floor, from the first rest

function onLoad()
  print("Dice measure script loaded on \"" .. self.getName() .. "\" (" .. self.getGUID() .. ").")
  -- A second way to start, for when the button is hidden, for example under a big or turned object
  self.addContextMenuItem("Measure dice", function() onMeasureClick() end)
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

function unit(v)
  local l = vecLength(v)
  return { x = v.x / l, y = v.y / l, z = v.z / l }
end

-- The rotation of `obj` as its 3 axis directions
function axes(obj)
  return { unit(obj.getTransformRight()), unit(obj.getTransformUp()), unit(obj.getTransformForward()) }
end

-- Angle in radians between two rotations, each given by axes(): the angle of the rotation
-- matrix A^T B, from its trace.
function turnAngle(a, b)
  local trace = 0
  for i = 1, 3 do trace = trace + a[i].x * b[i].x + a[i].y * b[i].y + a[i].z * b[i].z end
  return math.acos(math.max(-1, math.min(1, (trace - 1) / 2)))
end

-- Follows a rolled die frame by frame, from roll() until it rests. It reads the spin in two ways:
-- getAngularVelocity(), and the turn speed from the change of the rotation between two frames.
-- If roll() also turns the die without physics, only the second way sees it. Both are split into
-- the flight (until the first bounce) and the bounces. Call trackSpin once per frame.
function newSpinTracker(die)
  return {
    die = die, frames = 0, landed = false,
    prevAxes = axes(die), prevTime = Time.time, prevVy = die.getVelocity().y,
    flightSpin = 0, flightAngle = 0, flightTime = 0, bounceSpin = 0, bounceTurn = 0,
  }
end

function trackSpin(t)
  local now = Time.time
  local dt = now - t.prevTime
  if dt <= 0 then return end
  local a = axes(t.die)
  local vy = t.die.getVelocity().y
  local spin = vecLength(t.die.getAngularVelocity())
  t.frames = t.frames + 1
  -- Gravity only lowers the upward speed, so a rise while the die falls is the first bounce
  if not t.landed and t.prevVy < 0 and vy - t.prevVy > LANDING_JUMP then t.landed = true end
  local angle = turnAngle(t.prevAxes, a)
  if t.landed then
    t.bounceSpin = math.max(t.bounceSpin, spin)
    t.bounceTurn = math.max(t.bounceTurn, angle / dt)
  else
    t.flightSpin = math.max(t.flightSpin, spin)
    -- The first frames hold the random rotation that roll() snaps to, which is not a spin
    if t.frames > SNAP_FRAMES then
      t.flightAngle = t.flightAngle + angle
      t.flightTime = t.flightTime + dt
    end
  end
  t.prevAxes, t.prevTime, t.prevVy = a, now, vy
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
  -- The die's friction on the tray combines both values (Unity's default rule is Average)
  report(string.format("Tray: bounciness %.2f, static friction %.2f, dynamic friction %.2f",
    tray.bounciness, tray.static_friction, tray.dynamic_friction))
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
  local flightSpins, flightTurns, bounceSpins, bounceTurns = {}, {}, {}, {}
  local offFloor, timeouts = 0, 0
  table.insert(details, "Rolls of one die: up speed, spin, first-frame lift, highest point, rest time, off floor, "
    .. "flight spin, flight turn speed, bounce spin, bounce turn speed")
  for i = 1, ROLL_COUNT do
    local die = spawnAndSettle(1)[1]
    local restY = die.getPosition().y
    local rollTime = Time.time
    die.roll()
    local track = newSpinTracker(die)
    local upSpeed, spin, highest, lift = 0, 0, restY, nil
    for _ = 1, START_FRAMES do
      coroutine.yield(0)
      trackSpin(track)
      local y = die.getPosition().y
      if lift == nil then lift = y - restY end
      highest = math.max(highest, y)
      upSpeed = math.max(upSpeed, die.getVelocity().y)
      spin = math.max(spin, vecLength(die.getAngularVelocity()))
    end
    local rested = waitUntil(function()
      highest = math.max(highest, die.getPosition().y)
      trackSpin(track)
      return die.resting
    end)
    local flightTurn = track.flightTime > 0 and track.flightAngle / track.flightTime or 0
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
      table.insert(flightSpins, track.flightSpin)
      table.insert(flightTurns, flightTurn)
      table.insert(bounceSpins, track.bounceSpin)
      table.insert(bounceTurns, track.bounceTurn)
      table.insert(details, string.format("%d: %.2f, %.2f, %.2f, %.2f, %.2f, %s, %.2f, %.2f, %.2f, %.2f",
        i, upSpeed, spin, lift, highest - restY, restTime, off and "yes" or "no",
        track.flightSpin, flightTurn, track.bounceSpin, track.bounceTurn))
    end
    die.destruct()
    waitFrames(2)
  end
  report(string.format("%d rolls of one die:", ROLL_COUNT))
  report("  up speed in/s: " .. stats(upSpeeds))
  report("  spin rad/s: " .. stats(spins))
  report("  flight, highest getAngularVelocity() rad/s: " .. stats(flightSpins))
  report("  flight, average turn speed from the rotation rad/s: " .. stats(flightTurns))
  report("  bounces, highest getAngularVelocity() rad/s: " .. stats(bounceSpins))
  report("  bounces, highest turn speed from the rotation rad/s: " .. stats(bounceTurns))
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
