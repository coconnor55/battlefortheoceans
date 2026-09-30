# Game Bible v4.2 - Battle for the Oceans
**Comprehensive Architecture Documentation**
*Copyright © 2025, Clint H. O'Connor*

---

## Document Overview

Game Bible v4.2 represents the **implemented architecture** as of October 2025, incorporating the completed CoreEngine and Game.js refactoring, dual-engine system, emoji fire effects, progressive fog of war, and all current design patterns.

**Major Updates in v4.2:**
- ✅ **CoreEngine refactoring COMPLETE** - 798 lines (down from 1062, 25% reduction)
- ✅ **Game.js refactoring COMPLETE** - 679 lines (down from 1002, 32% reduction)
- ✅ **Extracted utility classes** - SessionManager, NavigationManager, SoundManager
- ✅ **Extracted game classes** - CombatResolver, GameLifecycleManager (expanded)
- ✅ **Extracted custom hooks** - useAutoPlay, useVideoTriggers
- ✅ **Munitions system** - Renamed from "resources" for better semantics
- 📊 **Complete file inventory** - 81 files with current versions
- 🎯 **Architecture goals achieved** - Files under 800 lines, clean separation

**Previous Major Updates:**
- v4.1: Resource refactoring, Midway Island expansion, coordinate system documentation
- v4.0: UXEngine architecture, dual-engine design, emoji fire system
- v3.9: Board/Game ownership refactor planning, overlay pattern
- v3.8: CanvasBoard unified component, particle system, simplified AI

---

## Table of Contents

1. [Vision & Scope](#vision--scope)
2. [Core Architecture](#core-architecture)
3. [Dual Engine System](#dual-engine-system)
4. [Refactoring Summary (v4.2)](#refactoring-summary-v42)
5. [State Machine & Flow](#state-machine--flow)
6. [Guest Player System](#guest-player-system)
7. [Statistics System](#statistics-system)
8. [Game Classes](#game-classes)
9. [Utility Classes](#utility-classes)
10. [Custom Hooks](#custom-hooks)
11. [Service Layer](#service-layer)
12. [Era Configuration](#era-configuration)
13. [Turn Management](#turn-management)
14. [AI System](#ai-system)
15. [Progressive Fog of War](#progressive-fog-of-war)
16. [Munitions System](#munitions-system)
17. [Animation System](#animation-system)
18. [UI Integration](#ui-integration)
19. [CSS Architecture](#css-architecture)
20. [Monetization](#monetization)
21. [Development Standards](#development-standards)
22. [Appendix A: File Inventory](#appendix-a-file-inventory)
23. [Appendix B: Refactoring Timeline](#appendix-b-refactoring-timeline)
24. [Appendix C: Coordinate System](#appendix-c-coordinate-system)
25. [Appendix D: Competitive Game Design](#appendix-d-competitive-game-design)

---

## Vision & Scope

### Core Vision

Battle for the Oceans is a **turn-based strategic naval combat game** that modernizes the classic 1930s Battleship experience into sophisticated multiplayer scenarios across different historical eras.

**Confirmed Scope - Rich 30-Minute Sessions:**
- **Turn-based gameplay only** - No realtime complexity
- **Deep strategic experience** in 20-30 minute sessions
- **Quality over quantity** - Polished, engaging tactical gameplay
- **Cross-platform responsive design** (desktop, mobile, tablet)

**Multi-era Naval Combat:**
- **Traditional Battleship** (10x10, classic gameplay) - Free
- **Midway Island** (13x13, WWII Pacific theater) - Premium
- **Pirates of the Gulf** (30x20+, irregular maps, alliance battles) - Future

**Gameplay Modes:**
- **Human vs AI** (primary focus)
- **Alliance-based scenarios** with strategic team formation
- **Intelligent AI opponents** with distinct personalities and strategies
- **Guest play support** for immediate access without registration

### Architectural Philosophy

**Turn-Based Strategic Focus:**
The game emphasizes thoughtful decision-making over reaction time. Each player considers their move carefully, analyzing the grid, tracking patterns, and planning their next attack.

**Synchronous Game Logic, Asynchronous Presentation:**
- **CoreEngine** - Game logic runs synchronously (state machine, turn management, combat)
- **UXEngine** - Presentation runs asynchronously at 30fps (animations, fire effects, particles)
- **Clean separation** - React manages state, engines handle execution and rendering

**30-Minute Session Design:**
Games are designed to provide a complete, satisfying experience in a single sitting. This targets the "lunch break" or "evening unwind" player who wants strategic depth without multi-hour commitments.

**Occam's Razor - Simple Over Clever:**
Throughout the refactoring process, we consistently chose simpler solutions over clever abstractions. "Working and boring" beats "clever and broken." Every extraction was justified by actual complexity, not theoretical elegance.

---

## Core Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────┐
│                     React Layer                          │
│  (State Management, User Input, Component Rendering)    │
└────────────────┬────────────────────────────────────────┘
                 │
      ┌──────────┴──────────┐
      │                     │
┌─────▼──────┐      ┌──────▼──────┐
│ CoreEngine │      │  UXEngine   │
│  (Logic)   │      │ (Rendering) │
│ 798 lines  │      │  ~100 lines │
└─────┬──────┘      └──────┬──────┘
      │                     │
      │   ┌─────────────────┘
      │   │
┌─────▼───▼─────────────────────────────────────┐
│          Domain Classes & Services             │
│  (Game, Player, Board, Ship, Fleet, etc.)    │
└───────────────────────────────────────────────┘
```

### Directory Structure (v4.2)

```
src/
├── engines/
│   ├── CoreEngine.js      # State machine orchestrator (v0.6.10, 798 lines)
│   └── UXEngine.js         # 30fps rendering loop (v0.1.0)
├── classes/
│   ├── Game.js             # Battle orchestrator (v0.8.8, 679 lines)
│   ├── Player.js           # Base player (v0.9.3)
│   ├── HumanPlayer.js      # Human player (v0.1.0)
│   ├── AiPlayer.js         # AI opponent (v0.5.0)
│   ├── Board.js            # Grid & terrain (v0.4.0)
│   ├── Ship.js             # Vessel logic (v0.2.1)
│   ├── Fleet.js            # Ship collection (v0.2.0)
│   ├── Alliance.js         # Team coordination (v0.1.2)
│   ├── Message.js          # Game messaging (v0.1.5)
│   ├── CombatResolver.js   # Combat mechanics (v0.1.0) ⭐ NEW
│   └── GameLifecycleManager.js # Game lifecycle (v0.2.3) ⭐ EXPANDED
├── utils/
│   ├── SessionManager.js   # Session storage (v0.1.0) ⭐ NEW
│   ├── NavigationManager.js # URL/browser nav (v0.1.0) ⭐ NEW
│   ├── SoundManager.js     # Audio system (v0.1.0) ⭐ NEW
│   ├── ConfigLoader.js     # Config loading (v1.1.0)
│   ├── MessageHelper.js    # Message utilities (v0.1.0)
│   ├── Debug.js            # Debug utilities (v0.1.3)
│   └── supabaseClient.js   # Database client (v0.1.6)
├── services/
│   ├── UserProfileService.js (v0.1.2)
│   ├── GameStatsService.js   (v0.3.2)
│   ├── LeaderboardService.js (v0.1.5)
│   ├── RightsService.js      (v0.1.0)
│   ├── AchievementService.js (v0.2.0)
│   └── StripeService.js      (v0.1.0)
├── renderers/
│   ├── TerrainRenderer.js    (v0.1.1)
│   ├── HitOverlayRenderer.js (v0.12.1)
│   └── AnimationManager.js   (v0.1.0)
├── components/
│   ├── CanvasBoard.js        (v0.4.10)
│   ├── NavBar.js             (v0.2.9)
│   ├── VideoPopup.js         (v0.1.5)
│   ├── FleetStatusSidebar.js (v0.2.0)
│   ├── AchievementNotification.js (v0.1.0)
│   └── [other UI components]
├── pages/
│   ├── LaunchPage.js         (v0.3.8)
│   ├── SelectEraPage.js      (v0.5.2)
│   ├── SelectOpponentPage.js (v0.6.1)
│   ├── PlacementPage.js      (v0.4.12)
│   ├── PlayingPage.js        (v0.5.3)
│   ├── OverPage.js           (v0.5.0)
│   ├── StatsPage.js          (v0.1.3)
│   └── [other pages]
├── context/
│   └── GameContext.js        (v0.4.5)
├── hooks/
│   ├── useGameState.js       (v0.3.2)
│   ├── useAutoPlay.js        (v0.1.0) ⭐ NEW
│   └── useVideoTriggers.js   (v0.1.0) ⭐ NEW
└── styles/
    ├── theme.css             (v0.1.6)
    ├── shared-components.css (v1.1.1)
    ├── modal-overlay.css     (v1.0.4)
    ├── buttons.css           (v1.0.1)
    ├── forms.css             (v1.0.1)
    ├── game-ui.css           (v2.2.4)
    ├── utilities.css         (v1.0.2)
    ├── stats.css             (v0.1.0)
    └── responsive.css        (v1.0.5)
```

---

## Dual Engine System

### CoreEngine (Game Logic)

**Location:** `src/engines/CoreEngine.js`  
**Current Version:** v0.6.10  
**Line Count:** 798 lines (down from 1062)

**Purpose:** Synchronous game logic orchestration

**Responsibilities:**
- State machine management
- Turn progression
- Session persistence
- Service coordination
- Observer pattern for UI updates

**Extracted Components (v0.6.4-v0.6.10):**
- SessionManager - Session storage (~150 lines)
- NavigationManager - URL/browser navigation (~200 lines)
- GameLifecycleManager - Game initialization (~114 lines)
- Service wrapper methods (~35 lines)
- Game logic methods → Game.js (~30 lines)

**Key Methods:**
```javascript
dispatch(event, data)           // Trigger state transition
transition(newState)            // Change game state
handleAttack(row, col)          // Process attack (delegates to Game.js)
fireMunition(type, row, col)    // Fire munitions (delegates to Game.js)
registerShipPlacement(...)      // Validate and place ship
getUIState()                    // Compute UI state
subscribe(callback)             // Subscribe to updates
logout()                        // Clear state and return to launch
```

**What Remains (All Legitimate):**
- State machine (events, states, transitions) - ~55 lines
- Constructor & initialization - ~106 lines
- State handlers (dispatch, transition, specific handlers) - ~155 lines
- Session orchestration (restore, save, clear) - ~87 lines
- Game orchestration (thin wrappers) - ~88 lines
- UI state aggregation - ~55 lines
- Service methods with business logic - ~40 lines
- Observer pattern - ~15 lines
- Helper methods - ~26 lines

### UXEngine (Presentation)

**Location:** `src/engine/UXEngine.js`  
**Current Version:** v0.1.0  
**Line Count:** ~100 lines

**Purpose:** Independent 30fps rendering loop

**Responsibilities:**
- Continuous canvas rendering at 30fps
- Fire/smoke particle animation
- Visual effect updates
- Frame rate management
- Animation coordination

**Key Characteristics:**
- **30fps loop** - Throttled requestAnimationFrame
- **Independent of React** - No re-render triggers
- **Reads props via refs** - Always current state
- **Smooth animations** - Fire, smoke, particles

**Core Methods:**
```javascript
start(renderCallback)    // Start rendering loop
stop()                   // Stop rendering loop
setFPS(fps)             // Adjust frame rate
getIsRunning()          // Check loop status
```

### Engine Interaction Pattern

```javascript
// In CanvasBoard.js
const uxEngineRef = useRef(new UXEngine());
const propsRef = useRef({ viewMode, gameState, ... });

// Update props ref on every render
useEffect(() => {
  propsRef.current = { viewMode, gameState, ... };
}, [viewMode, gameState, ...]);

// Start UXEngine with render callback
useEffect(() => {
  uxEngine.start(() => {
    const props = propsRef.current;
    renderFrame(props);
  });
  
  return () => uxEngine.stop();
}, []);
```

**Benefits:**
- ✅ No React re-render cascades
- ✅ Smooth 30fps animations
- ✅ viewMode always current (no stale prop issues)
- ✅ Fire/smoke animate independently
- ✅ Clean separation of concerns

---

## Refactoring Summary (v4.2)

### The Big Picture

**Total Reduction:** 2064 → 1477 lines (**587 lines removed, 28% reduction**)

### CoreEngine.js Refactoring

| Version | Lines | Change | Description |
|---------|-------|--------|-------------|
| v0.6.3 | 1062 | Start | Before refactoring |
| v0.6.4 | ~912 | -150 | Extracted SessionManager |
| v0.6.6 | ~983 | +71/-200 | Extracted NavigationManager, added helpers |
| v0.6.7 | ~870 | -113 | Delegated to GameLifecycleManager |
| v0.6.8 | ~841 | -29 | Removed service wrapper methods |
| v0.6.9 | ~772 | -69 | Moved game logic to Game.js |
| v0.6.10 | **798** | +26 | Renamed resources → munitions |

**Total Reduction:** 1062 → 798 lines (**264 lines, 25% reduction**)

**Git Tags:**
- `v0.6.4-session-manager`
- `v0.6.6-navigation-manager`
- `v0.6.7-lifecycle-manager`
- `v0.6.10-coreengine-complete`

### Game.js Refactoring

| Version | Lines | Change | Description |
|---------|-------|--------|-------------|
| v0.8.3 | 1002 | Start | Before refactoring (with 214-line monster!) |
| v0.8.4 | ~700 | -302 | Extracted CombatResolver |
| v0.8.5 | ~660 | -40 | Extracted SoundManager |
| v0.8.6 | ~564 | -96 | Extracted GameLifecycleManager |
| v0.8.7 | ~594 | +30 | Added munitions methods |
| v0.8.8 | **679** | +85 | Final munitions system |

**Total Reduction:** 1002 → 679 lines (**323 lines, 32% reduction**)

**Git Tags:**
- `v0.8.4-combat-resolver`
- `v0.8.5-sound-manager`
- `v0.8.6-lifecycle-manager`
- `v0.8.8-game-complete`

### Extraction Summary

**New Utility Classes:**
1. **SessionManager.js** (v0.1.0) - ~150 lines
   - Session storage, restoration, clearing
   - Extracted from CoreEngine

2. **NavigationManager.js** (v0.1.0) - ~200 lines
   - URL synchronization, browser navigation
   - Extracted from CoreEngine

3. **SoundManager.js** (v0.1.0) - ~40 lines
   - Audio initialization, playback
   - Extracted from Game.js

**New Game Classes:**
1. **CombatResolver.js** (v0.1.0) - ~300 lines
   - receiveAttack(), calculateDamage(), processAttack()
   - registerShipPlacement(), isValidAttack()
   - Extracted from Game.js

2. **GameLifecycleManager.js** (v0.2.3) - ~280 lines
   - Initialization: initializeForPlacement(), calculateMunitionWithBoost()
   - End-game: checkGameEnd(), endGame(), cleanupTemporaryAlliances(), reset()
   - Extracted from CoreEngine + Game.js

**New Custom Hooks:**
1. **useAutoPlay.js** (v0.1.0) - ~40 lines
   - Testing/debug autoplay utility
   - Extracted from PlayingPage

2. **useVideoTriggers.js** (v0.1.0) - ~60 lines
   - Video popup management
   - Extracted from PlayingPage

### Key Achievements ✨

1. ✅ **No Monster Methods** - Longest method now ~50 lines (vs 214 before!)
2. ✅ **Clean Delegation** - Each class has single responsibility
3. ✅ **Thin Orchestrators** - CoreEngine and Game.js coordinate, don't implement
4. ✅ **Maintainable** - Easy to find and modify functionality
5. ✅ **Testable** - Extracted classes can be tested independently
6. ✅ **Readable** - No file over 800 lines

### Philosophy Reinforced

**"Single Responsibility Principle"**
- CoreEngine: State machine orchestration only
- Game.js: Game coordination and turn management only
- CombatResolver: Combat mechanics only
- SessionManager: Session storage only
- NavigationManager: URL/browser navigation only

**"Files Should Be 200-800 Lines"**
- Any file over 800 lines needs extraction
- Any method over 50 lines needs refactoring
- receiveAttack() at 214 lines violated this egregiously - FIXED

**"Occam's Razor - Simple Beats Clever"**
- Prefer explicit, boring code
- Only extract when complexity demands it
- Don't over-abstract
- "Working and boring" > "clever and broken"

---

## State Machine & Flow

### Core States

```
launch → login → era → opponent → placement → play → gameover
```

**State Definitions:**

| State | Purpose | Valid Transitions |
|-------|---------|------------------|
| `launch` | Initial landing | → login, era |
| `login` | Authentication | → era |
| `era` | Era selection | → opponent, achievements |
| `opponent` | Choose opponent | → placement, era, achievements |
| `placement` | Ship placement | → play, opponent, achievements |
| `play` | Active battle | → over |
| `over` | Results | → era, opponent, placement, launch, achievements |

### Event System

**Events trigger state transitions:**

```javascript
// From CoreEngine
const events = {
  LAUNCH: Symbol('LAUNCH'),
  LOGIN: Symbol('LOGIN'),
  SELECTERA: Symbol('SELECTERA'),
  SELECTOPPONENT: Symbol('SELECTOPPONENT'),
  PLACEMENT: Symbol('PLACEMENT'),
  PLAY: Symbol('PLAY'),
  OVER: Symbol('OVER'),
  ERA: Symbol('ERA'),
  ACHIEVEMENTS: Symbol('ACHIEVEMENTS')
};

// Usage
dispatch(events.PLAY); // Triggers placement → play transition
```

### State Persistence

**Handled by SessionManager.js (v0.1.0):**

```javascript
// SessionManager.save(coreEngine)
{
  currentState: 'play',
  user: { id, game_name },
  eraId: 'traditional',
  selectedOpponents: [...],
  selectedGameMode: 'solo',
  selectedAlliance: 'Allies',
  gameInstance: { serialized game state }
}
```

**Restoration on Refresh:**
- SessionManager.restore() retrieves from sessionStorage
- CoreEngine restores players, era config, and game state
- User returns to exact game position

---

## Guest Player System

### ID Prefix Pattern

**Guest Detection:**
```javascript
const isGuest = userId.startsWith('guest-');
const isAI = userId.startsWith('ai-');
```

**Guest ID Format:**
```
guest-{timestamp}-{random}
Example: guest-1696847392847-abc123
```

### Guest Workflow

1. **Launch page** - User can play immediately as guest
2. **Guest profile creation** - Temporary session-based profile
3. **Full gameplay** - Complete access to all features
4. **Statistics tracking** - Guest stats saved but not on leaderboards
5. **Optional conversion** - Guest can create account to persist data

### Service Layer Filtering

**Leaderboard Service:**
```javascript
// Exclude guests from leaderboards
const { data } = await supabase
  .from('player_statistics')
  .select('*')
  .not('user_id', 'like', 'guest-%')
  .not('user_id', 'like', 'ai-%')
  .order('score', { ascending: false });
```

**Stats Service:**
```javascript
// Record guest stats but don't affect rankings
if (userId.startsWith('guest-')) {
  // Track locally only
  return;
}
// Normal user - update database
await supabase.from('player_statistics').upsert(stats);
```

---

## Statistics System

### Single Source of Truth

**All statistics live in Player.js constructor:**

```javascript
class Player {
  constructor(id, name, type = 'human', alliance = null, difficulty = 1.0) {
    // Statistics - SINGLE SOURCE OF TRUTH
    this.hits = 0;
    this.misses = 0;
    this.sunk = 0;
    this.hitsDamage = 0;
    this.score = 0;
  }
  
  // Computed getters
  get shots() { return this.hits + this.misses; }
  get accuracy() { return this.shots > 0 ? (this.hits / this.shots) * 100 : 0; }
  get averageDamage() { return this.hits > 0 ? this.hitsDamage / this.hits : 0; }
  get damagePerShot() { return this.shots > 0 ? this.hitsDamage / this.shots : 0; }
}
```

### Statistics Flow

```
CombatResolver.receiveAttack()
  ↓
Update attacker.hits/misses/hitsDamage
  ↓
CoreEngine.handleGameOver()
  ↓
GameStatsService.updateGameStats()
  ↓
Database update (non-guest users only)
```

**NEVER:**
- Initialize statistics outside Player.js
- Duplicate statistics in other classes
- Map/transform statistics in services
- Store statistics in multiple places

**ALWAYS:**
- Read directly from Player instance
- Use Player getters for computed values
- Update only through Player methods
- Let services use Player stats as-is

---

## Game Classes

### Game.js

**Current Version:** v0.8.8  
**Line Count:** 679 lines (down from 1002)

**Purpose:** Turn-based battle orchestrator

**Key Responsibilities:**
- Player/alliance management
- Turn management
- Action queue processing
- Game state coordination
- Statistics aggregation

**Delegated Responsibilities (v0.8.4-v0.8.6):**
- Combat mechanics → CombatResolver
- Sound management → SoundManager
- Game lifecycle → GameLifecycleManager

**Key Methods:**
```javascript
// Player management
addPlayer(player, allianceName)
addPlayerWithFleet(player, allianceName, ships)  // v0.8.0: Pirates support
getPlayer(playerId)
getCurrentPlayer()

// Turn management
processPlayerAction(action, data)
handleTurnProgression(wasHit)
checkAndTriggerAITurn()
executeAITurnQueued(aiPlayer)
nextTurn()

// Combat (delegated to CombatResolver)
receiveAttack(row, col, firingPlayer, damage)
calculateDamage(firingPlayer, targetPlayer, targetShip, baseDamage)
registerShipPlacement(ship, shipCells, orientation, playerId)
processAttack(attacker, row, col)
isValidAttack(row, col, firingPlayer)

// Lifecycle (delegated to GameLifecycleManager)
startGame()
checkGameEnd()
endGame()
reset()
cleanupTemporaryAlliances()

// Munitions (v0.8.8)
initializeMunitions(starShells, scatterShot)
fireMunition(munitionType, row, col)

// Statistics
getGameStats()
getPlayerStats()  // Aggregates human + AI stats

// Callbacks
setUIUpdateCallback(callback)
setGameEndCallback(callback)
setOnShipSunk(callback)      // v0.8.1
setOnGameOver(callback)      // v0.8.3
```

**Munitions System (v0.8.8):**
- Renamed from "resources" for better semantics
- Star shells, scatter shot are munitions, not resources
- More extensible for future types (flares, torpedoes, depth charges)

### CombatResolver.js ⭐ NEW

**Current Version:** v0.1.0  
**Line Count:** ~300 lines

**Purpose:** Combat mechanics and damage calculation

**Extracted From:** Game.js v0.8.4 (removed 214-line monster method!)

**Responsibilities:**
- Attack processing
- Damage calculation
- Ship placement validation
- Attack validation

**Key Methods:**
```javascript
receiveAttack(row, col, firingPlayer, damage)  // 214 lines → extracted!
calculateDamage(firingPlayer, targetPlayer, targetShip, baseDamage)
processAttack(attacker, row, col)
registerShipPlacement(ship, shipCells, orientation, playerId)
isValidAttack(row, col, firingPlayer)
```

**Pattern:**
```javascript
class Game {
  constructor() {
    this.combatResolver = new CombatResolver(this);
  }
  
  receiveAttack(row, col, firingPlayer, damage) {
    return this.combatResolver.receiveAttack(row, col, firingPlayer, damage);
  }
}
```

### GameLifecycleManager.js ⭐ EXPANDED

**Current Version:** v0.2.3  
**Line Count:** ~280 lines

**Purpose:** Game initialization and termination

**Extracted From:**
- CoreEngine v0.6.7 (~114 lines initialization)
- Game.js v0.8.6 (~131 lines end-game)

**Responsibilities:**
- Game initialization (placement setup)
- Munition calculation with boosts
- End-game detection
- Victory/defeat handling
- Board snapshot capture
- Alliance cleanup
- Game reset

**Key Methods:**
```javascript
// Initialization
initializeForPlacement(coreEngine)
calculateMunitionWithBoost(base, boost, opponentCount)
getOpposingAlliance(allianceName)

// End-game
checkGameEnd()
endGame()
cleanupTemporaryAlliances()
reset()
```

**Pattern:**
```javascript
class CoreEngine {
  constructor() {
    this.lifecycleManager = new GameLifecycleManager(this);
  }
  
  handleEvent_placement() {
    this.lifecycleManager.initializeForPlacement(this);
  }
}

class Game {
  constructor() {
    this.lifecycleManager = new GameLifecycleManager(this);
  }
  
  checkGameEnd() {
    return this.lifecycleManager.checkGameEnd();
  }
}
```

### Player.js

**Current Version:** v0.9.3  
**Line Count:** ~250 lines

**Purpose:** Base player class with statistics

**Key Properties:**
```javascript
id                  // Unique identifier
name                // Display name
type                // 'human' or 'ai'
alliance            // Team affiliation
difficulty          // AI difficulty (0.0-1.0)

// Statistics (SSOT)
hits                // Successful attacks
misses              // Failed attacks
sunk                // Ships destroyed
hitsDamage          // Total damage dealt
score               // Game score

// Fleet management
fleet               // Fleet instance
shipPlacements      // Map of placed ships
dontShoot           // Set of fired coordinates
```

**Key Methods:**
```javascript
reset()                              // Clear for new game
recordShot(targetId, row, col, result) // Track attack
canShootAt(row, col)                 // Check if valid target
getDontShoot()                       // Get fired coordinates
getShipAt(row, col)                  // Find ship at position
getShip(shipId)                      // Get ship by ID
autoPlaceShips(game, fleet)          // Auto-placement
```

### Ship.js

**Current Version:** v0.2.1  
**Line Count:** ~180 lines

**Purpose:** Individual vessel with health system

**Key Properties:**
```javascript
id                  // Unique ship ID
name                // Ship name
class               // Ship class
size                // Number of cells
maxHealth           // Total HP
health              // Array of cell HP values
hits                // Hit counter
terrain             // Valid terrain types
healthPerCell       // HP per cell (from era config)
```

**Progressive Fog of War:**
```javascript
getRevealLevel()    // Returns: hidden, hit, size-hint, critical, sunk
getCurrentHealth()  // Sum of all cell health
isSunk()            // Check if destroyed
receiveHit(cellIndex, damage)  // Apply damage to cell
```

**Health Tiers (from era config):**
- **Submarine:** 3 cells × 2.0 HP = 6.0 total (toughest)
- **Battleship:** 4 cells × 1.5 HP = 6.0 total
- **Carrier:** 5 cells × 1.0 HP = 5.0 total
- **Cruiser:** 3 cells × 1.0 HP = 3.0 total
- **Destroyer:** 2 cells × 1.0 HP = 2.0 total

### Board.js

**Current Version:** v0.4.0  
**Line Count:** ~220 lines

**Purpose:** Spatial logic and terrain management

**Key Methods:**
```javascript
registerShipPlacement(ship, cells, orientation, playerId)
getShipDataAt(row, col)              // Get ship at position
isValidCoordinate(row, col)          // Check bounds
recordShot(row, col, playerId)       // Track attack
getShipCells(shipId)                 // Get ship positions
clear()                              // Reset board
```

### Fleet.js

**Current Version:** v0.2.0  
**Line Count:** ~150 lines

**Purpose:** Ship collection per player

**Key Methods:**
```javascript
static fromEraConfig(playerId, eraConfig, alliance)  // Factory
static fromShipArray(playerId, ships, alliance)      // v0.2.0: Pirates support
addShip(ship)                        // Add vessel
removeShip(shipId)                   // Remove vessel
isDefeated()                         // Check if all sunk
getStats()                           // Export statistics
```

---

## Utility Classes

### SessionManager.js ⭐ NEW

**Current Version:** v0.1.0  
**Line Count:** ~150 lines

**Purpose:** Session storage management

**Extracted From:** CoreEngine v0.6.4

**Responsibilities:**
- Session data persistence
- Session restoration
- Session clearing
- Profile/era refresh

**Key Methods:**
```javascript
static restore()                     // Restore from sessionStorage
static save(coreEngine)              // Save to sessionStorage
static clear()                       // Clear sessionStorage
static refreshProfileAsync(coreEngine)  // Refresh user profile
static restoreEraAsync(coreEngine, eraId)  // Restore era config
```

**Pattern:**
```javascript
// In CoreEngine constructor
restoreSession() {
  const sessionData = SessionManager.restore();
  if (sessionData) {
    this.currentState = sessionData.currentState;
    this.userProfile = sessionData.user;
    // ... restore other state
  }
}

saveSession() {
  SessionManager.save(this);
}
```

### NavigationManager.js ⭐ NEW

**Current Version:** v0.1.0  
**Line Count:** ~200 lines

**Purpose:** URL synchronization and browser navigation

**Extracted From:** CoreEngine v0.6.6

**Responsibilities:**
- URL initialization from route
- URL synchronization on state change
- Browser back/forward handling
- State transition validation

**Key Methods:**
```javascript
initializeFromURL()                  // Parse URL, set initial state
syncURL(state)                       // Update URL bar
handleBrowserNavigation(event)       // Handle popstate events
isValidBackwardTransition(from, to)  // Validate back button
```

**Route Mappings:**
```javascript
const stateToRoute = {
  'launch': '/',
  'login': '/login',
  'era': '/select-era',
  'opponent': '/select-opponent',
  'placement': '/placement',
  'play': '/battle',
  'over': '/gameover'
};
```

**Pattern:**
```javascript
// In CoreEngine
this.navigationManager = new NavigationManager(this);

transition(newState) {
  this.currentState = newState;
  this.navigationManager.syncURL(newState);
}
```

### SoundManager.js ⭐ NEW

**Current Version:** v0.1.0  
**Line Count:** ~40 lines

**Purpose:** Audio playback management

**Extracted From:** Game.js v0.8.5

**Responsibilities:**
- Sound effect initialization
- Sound playback with delay
- Sound enable/disable toggle

**Key Methods:**
```javascript
initializeSounds(soundEffects)       // Initialize audio elements
playSound(soundType, delay)          // Play with optional delay
toggleSound(enabled)                 // Enable/disable sounds
```

**Pattern:**
```javascript
class Game {
  constructor() {
    this.soundManager = new SoundManager();
  }
  
  playSound(soundType, delay) {
    this.soundManager.playSound(soundType, delay);
  }
}
```

### ConfigLoader.js

**Current Version:** v1.1.0  
**Line Count:** ~120 lines

**Purpose:** Era configuration loading with caching

**Key Methods:**
```javascript
static async loadEraConfig(eraId)    // Load era config
static async loadAllEraConfigs()     // Load all eras
static clearCache()                  // Clear config cache
```

### MessageHelper.js

**Current Version:** v0.1.0  
**Line Count:** ~80 lines

**Purpose:** Message interpolation utilities

**Key Methods:**
```javascript
static interpolate(template, context)  // Replace {variables}
static formatPlayerName(player)        // Format player name
static formatCell(row, col)            // Format grid coordinate
```

---

## Custom Hooks

### useGameState.js

**Current Version:** v0.3.2  
**Line Count:** ~120 lines

**Purpose:** Game state abstraction for React components

**Returned State:**
```javascript
{
  // Game state
  isPlayerTurn, currentPlayer, isGameActive,
  gamePhase, winner, gameMode, userId,
  
  // Messages
  battleMessage, uiMessage, systemMessage,
  
  // Statistics
  playerHits, opponentHits, playerShots, opponentShots, accuracy,
  
  // Placement
  currentShipIndex, totalShips, currentShip, isPlacementComplete,
  
  // Board
  gameBoard,
  
  // Munitions (v0.3.2)
  munitions, starShellsRemaining, scatterShotRemaining,
  
  // Actions
  handleAttack, fireMunition, resetGame, isValidAttack, getGameStats,
  
  // Context
  eraConfig, selectedOpponent, game
}
```

**No Local State:**
- All state computed from CoreEngine
- No duplication of game data
- Single source of truth in CoreEngine

### useAutoPlay.js ⭐ NEW

**Current Version:** v0.1.0  
**Line Count:** ~40 lines

**Purpose:** Testing/debug autoplay utility

**Extracted From:** PlayingPage v0.5.0+

**Functionality:**
- Automatically fires at random valid coordinates
- Configurable delay between shots
- Enable/disable via query parameter
- Debug utility only

**Usage:**
```javascript
const { autoPlayEnabled } = useAutoPlay({
  isPlayerTurn,
  gameBoard,
  handleAttack,
  delay: 1000  // ms between shots
});
```

### useVideoTriggers.js ⭐ NEW

**Current Version:** v0.1.0  
**Line Count:** ~60 lines

**Purpose:** Video popup management

**Extracted From:** PlayingPage v0.5.0+

**Functionality:**
- Manages video popup state
- Handles video selection and playback
- Synchronizes with game events (ship sunk, game over)
- Prevents multiple popups

**Usage:**
```javascript
const {
  videoPopupData,
  showVideoPopup,
  handleCloseVideoPopup
} = useVideoTriggers({
  game,
  onShipSunk: game?.onShipSunk,
  onGameOver: game?.onGameOver
});
```

---

## Service Layer

### UserProfileService

**Current Version:** v0.1.2  
**Purpose:** Profile CRUD operations

**Key Methods:**
```javascript
getUserProfile(userId)                // Fetch profile
createUserProfile(userId, gameName)   // Create profile
validateGameName(gameName)            // Check validity
checkGameNameAvailability(gameName)   // Check uniqueness
```

### GameStatsService

**Current Version:** v0.3.2  
**Purpose:** Statistics management

**Key Methods:**
```javascript
updateGameStats(userProfile, gameResults)  // Update stats
calculateGameResults(game, eraConfig, opponent)  // Compute results
recordGameCompletion(game, winner)    // Save completion
getTotalGamesPlayed(userId)           // Get game count
```

**Statistics Calculation:**
- Reads directly from Player instances
- No mapping or transformation
- Uses Player getters for computed values
- Updates database for non-guest users only

### LeaderboardService

**Current Version:** v0.1.5  
**Purpose:** Rankings and champion tracking

**Key Methods:**
```javascript
getLeaderboard(eraId, limit)          // Get top players
getRecentChampions(eraId, limit)      // Recent winners
getPlayerRanking(userId, eraId)       // Player position
getPlayerPercentile(userId, eraId)    // Percentile rank
```

**Filtering:**
- Excludes `guest-*` and `ai-*` users
- Only authenticated players on leaderboards
- Tracks wins, losses, accuracy, score

### AchievementService

**Current Version:** v0.2.0  
**Purpose:** Achievement tracking and unlocking

**Key Methods:**
```javascript
checkAchievements(userId, gameResults)  // Check for new achievements
getPlayerAchievements(userId)           // Get all achievements
unlockAchievement(userId, achievementId) // Unlock specific achievement
```

---

## Era Configuration

### Structure

**Location:** `public/data/era_*.json`

**Core Fields:**
```json
{
  "id": "traditional",
  "name": "Traditional Battleship",
  "description": "...",
  "version": "1.0.0",
  "status": "active",
  "price": 0,
  "rows": 10,
  "cols": 10,
  "terrain": [...],
  "ships": [...],
  "messages": {...},
  "munitions": {
    "star_shells": { "base": 2, "boost": 1 },
    "scatter_shot": { "base": 1, "boost": 0 }
  }
}
```

### Ship Configuration

```json
{
  "id": "submarine",
  "name": "Submarine",
  "class": "Submarine",
  "size": 3,
  "health_per_cell": 2.0,
  "size_category": "medium",
  "terrain": ["water", "deep"]
}
```

### Midway Island (v0.3.3)

**Board Size:** 13×13 (169 cells)

**US Navy Fleet (33 cells, 19.5% coverage):**
- 3× Carriers (5 cells each) = 15 cells
- 1× Heavy Cruiser (4 cells) = 4 cells
- 2× Light Cruisers (3 cells each) = 6 cells
- 1× Submarine (3 cells) = 3 cells
- 2× Destroyers (2 cells each) = 4 cells
- 1× PT Boat (1 cell) = 1 cell

**Imperial Navy Fleet (31 cells, 18.3% coverage):**
- 4× Carriers (5 cells each) = 20 cells
- 1× Heavy Cruiser (4 cells) = 4 cells
- 2× Light Cruisers (3 cells each) = 6 cells
- 1× Submarine (3 cells) = 3 cells
- 1× Destroyer (2 cells) = 2 cells

**Game Length:** 5-6 minutes (perfect for target)

### Message System

**Message Types:**
```json
{
  "messages": {
    "game_start": "Battle begins! {player1} vs {player2}",
    "turn": "{player}'s turn",
    "attack_miss": "You fired at {cell} - miss.",
    "attack_hit_unknown": "You fired at {cell} - HIT!",
    "attack_hit_size_small": "HIT at {cell}! It's a small vessel!",
    "attack_hit_size_medium": "HIT at {cell}! It's a medium-sized ship!",
    "attack_hit_size_large": "HIT at {cell}! It's a large warship!",
    "attack_hit_critical": "CRITICAL HIT at {cell}! It's a {shipClass}!",
    "ship_sunk": "You sank the enemy {shipName} at {cell}!",
    "game_over_win": "Victory! You sank all enemy ships!",
    "game_over_lose": "Defeat! Your fleet was destroyed."
  }
}
```

**Context Variables:**
- `{player}`, `{player1}`, `{player2}` - Player names
- `{cell}` - Grid coordinate ("C5")
- `{opponent}` - Opponent name
- `{shipClass}` - Ship class (when revealed)
- `{shipName}` - Ship name (when revealed)
- `{sizeCategory}` - "small", "medium", "large"

---

## Turn Management

### Turn Flow

```
Player Turn Start
  ↓
Player Selects Target
  ↓
CombatResolver.receiveAttack() [SYNCHRONOUS]
  ↓
Update Statistics
  ↓
Check Game End
  ↓
If game continues:
  ↓
Game.handleTurnProgression()
  ↓
If AI turn:
  ↓
Game.checkAndTriggerAITurn() [Queue AI move]
  ↓
CoreEngine state update
  ↓
React re-render
  ↓
Game.executeAITurnQueued() [Execute AI move]
```

### Synchronous Player Attacks

**Player attacks execute immediately:**

```javascript
handleAttack(row, col) {
  // Synchronous execution
  const result = gameInstance.receiveAttack(row, col, humanPlayer);
  
  // Immediate particle effects
  showShotAnimation(result, row, col);
  
  return result;
}
```

**AI attacks are queued:**

```javascript
handleTurnProgression() {
  this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
  this.turnCount++;
  
  // Queue AI move for after state update
  if (this.getCurrentPlayer().type === 'ai') {
    this.aiTurnQueued = true;
  }
}
```

**Benefits:**
- Player sees immediate visual feedback
- Particle effects trigger instantly
- AI moves don't block UI
- Smooth turn transitions

---

## AI System

### AI Strategies

**Four Core Strategies:**

1. **Random** - Pure random targeting
2. **Hunt/Target** - Hunt mode until hit, then target mode
3. **Probabilistic** - Weight cells by likelihood
4. **Methodical Random** - Checkerboard pattern first, then random

**Difficulty Multiplier:**
- `difficulty` (0.0 to 1.0) affects decision quality
- Higher difficulty = smarter move selection
- No artificial delays or "skill levels"

### AiPlayer.js

**Current Version:** v0.5.0

**Key Methods:**
```javascript
makeMove(game)                       // Execute AI turn
selectTarget(game)                   // Choose target cell
processAttackResult(row, col, result) // Learn from attack
```

**Strategy-Specific Methods:**
- `selectRandomTarget()`
- `selectHuntTarget()` / `selectTargetModeTarget()`
- `selectProbabilisticTarget()`
- `selectMethodicalTarget()`

**AI Memory:**
```javascript
memory = {
  lastHit: null,            // Recent successful hit
  targetQueue: [],          // Cells to investigate
  huntMode: true,           // Hunt vs Target mode
  methodicalCells: [...],   // Checkerboard cells remaining
  probabilities: Map        // Cell likelihood weights
}
```

---

## Progressive Fog of War

### Reveal Levels

**Ship reveal progression:**

1. **Hidden** (`hidden`) - No information
2. **First Hit** (`hit`) - "HIT!" - unknown ship
3. **Size Hint** (`size-hint`) - "It's a large warship!" - 2nd hit reveals size category
4. **Critical Damage** (`critical`) - "It's a Battleship!" - <50% HP reveals ship class
5. **Sunk** (`sunk`) - "Battleship SUNK!" - confirmed destruction

### Implementation

**In Ship.js:**
```javascript
getRevealLevel() {
  const healthPercent = this.getCurrentHealth() / this.maxHealth;
  
  if (this.isSunk()) return 'sunk';
  if (healthPercent < 0.5) return 'critical';
  if (this.hits >= 2) return 'size-hint';
  if (this.hits >= 1) return 'hit';
  return 'hidden';
}
```

**In CombatResolver.js:**
```javascript
// Select appropriate message based on reveal level
const revealLevel = ship.getRevealLevel();

if (revealLevel === 'sunk') {
  messageType = 'ship_sunk';
} else if (revealLevel === 'critical') {
  messageType = 'attack_hit_critical';
} else if (revealLevel === 'size-hint') {
  messageType = `attack_hit_size_${ship.sizeCategory}`;
} else {
  messageType = 'attack_hit_unknown';
}
```

### Size Categories

**From era config:**
- **Small:** 2-cell ships (Destroyer, PT Boat)
- **Medium:** 3-cell ships (Cruiser, Submarine)
- **Large:** 4-5 cell ships (Battleship, Carrier)

---

## Munitions System

### Overview (v0.8.8)

**Renamed from "resources"** for better semantics:
- Star shells, scatter shot are **munitions**, not resources
- More extensible for future types (flares, torpedoes, depth charges)
- Clearer intent in code and UI

### Era Configuration

```json
{
  "munitions": {
    "star_shells": {
      "base": 2,
      "boost": 1
    },
    "scatter_shot": {
      "base": 1,
      "boost": 0
    }
  }
}
```

### Boost Formula

**Multi-opponent scaling:**

```javascript
// In GameLifecycleManager
calculateMunitionWithBoost(base, boost, opponentCount) {
  return base + (boost * (opponentCount - 1));
}

// Example: Traditional Battleship (1 opponent)
starShells = 2 + (1 × 0) = 2

// Example: Pirates of the Gulf (3 opponents)
starShells = 2 + (1 × 2) = 4
```

### Game.js Integration

```javascript
class Game {
  constructor() {
    // v0.8.8: Munitions tracking
    this.munitions = {
      starShells: 0,
      scatterShot: 0
    };
  }
  
  initializeMunitions(starShells, scatterShot) {
    this.munitions.starShells = starShells;
    this.munitions.scatterShot = scatterShot;
  }
  
  fireMunition(munitionType, row, col) {
    if (this.state !== 'playing') return false;
    
    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer?.type !== 'human') return false;
    
    const munitionKey = munitionType === 'starShell' ? 'starShells' :
                        munitionType === 'scatterShot' ? 'scatterShot' : null;
    
    if (!munitionKey || this.munitions[munitionKey] <= 0) {
      return false;
    }
    
    // Decrement munition count
    this.munitions[munitionKey]--;
    
    // Advance turn (munitions consume turn)
    this.handleTurnProgression();
    
    return true;
  }
}
```

### UI Integration

```javascript
// In useGameState.js v0.3.2
const munitions = gameInstance?.munitions || { starShells: 0, scatterShot: 0 };
const starShellsRemaining = munitions.starShells;
const scatterShotRemaining = munitions.scatterShot;

// In PlayingPage.js v0.5.3
const { starShellsRemaining, fireMunition } = useGameState();

const handleStarShellFired = useCallback((row, col) => {
  const success = fireMunition('starShell', row, col);
  if (success) {
    // Trigger star shell visual effect
  }
}, [fireMunition]);
```

---

## Animation System

### UXEngine Integration

**Continuous Rendering:**
- UXEngine runs at 30fps independent of React
- Fire/smoke particles update every frame
- Smooth animations without React re-renders

### HitOverlayRenderer

**Current Version:** v0.12.1

**Purpose:** Emoji-based fire and smoke effects

**Fire System:**
```javascript
// 3 layered fire emoji per cell
{
  type: 'fire',
  emoji: '🔥',
  baseX, baseY,           // Position
  wobbleOffset,           // Animation phase
  wobbleSpeed,            // Movement speed
  scaleOffset,            // Size phase
  baseScale,              // Layer depth (0.8, 0.95, 1.1)
  opacityOffset,          // Flicker phase
  opacitySpeed            // Flicker rate
}
```

**Smoke System:**
```javascript
// 2 smoke puffs per cell
{
  type: 'smoke',
  emoji: '💨',
  baseX, baseY,           // Start position
  life, maxLife,          // Lifetime
  driftX, driftY,         // Drift toward 2 o'clock
  baseOpacity: 0.2-0.4,   // Varying transparency
  scale: 0.4-0.6          // Size variation
}
```

**Animation Loop:**
```javascript
updateFireParticles() {
  this.fireAnimationFrame++;
  
  // Update smoke positions
  for (smoke particles) {
    lifeRatio = life / maxLife;
    driftX = lifeRatio * 40 * cos(30°);  // Right
    driftY = -lifeRatio * 40 * sin(30°); // Up
  }
  
  // Fire particles animate via sin/cos offsets
}
```

**Fire Coverage:**
- Fire emoji covers 80% of cell
- Smoke drifts above cell boundary
- Opacity 0.2-0.4 for smoke
- Flickering 0.7-1.0 for fire

### AnimationManager

**Current Version:** v0.1.0

**Purpose:** Explosion particles and shot animations

**Explosion System:**
```javascript
createExplosion(row, col, isOpponentHit, cellSize, labelSize)
```

**Particle Properties:**
- 20-30 particles per explosion
- Radial distribution
- Gravity simulation
- Color based on attacker (red for player, blue for opponent)
- Fade out over 1 second

**Shot Animations:**
```javascript
addAnimation(id, type, row, col, radius, color)
```

**Animation Types:**
- `hit` - Expanding circle
- `miss` - Expanding ring
- `splash` - Multi-ring effect

### TerrainRenderer

**Current Version:** v0.1.1

**Purpose:** Pre-rendered terrain layer

**Caching:**
- Terrain rendered once and cached
- Clear cache on era change
- Optimized grid drawing
- Label rendering (A-Z, 1-N)

---

## UI Integration

### CanvasBoard

**Current Version:** v0.4.10

**Purpose:** Unified canvas component for placement and battle

**Modes:**
- `placement` - Ship placement with drag preview
- `battle` - Combat with attack targeting

**View Modes (battle only):**
- `fleet` - Show player ships and enemy attacks
- `attack` - Show player attacks on enemy (hides player ships)
- `blended` - Show both fleet and attacks (default)

**UXEngine Integration:**
```javascript
// Store props in ref for UXEngine access
const propsRef = useRef({ mode, viewMode, gameState, ... });

// Update ref on every render
useEffect(() => {
  propsRef.current = { mode, viewMode, gameState, ... };
}, [mode, viewMode, gameState, ...]);

// Start UXEngine with render callback
useEffect(() => {
  uxEngine.start(() => {
    const props = propsRef.current;
    renderFrame(props);
  });
  return () => uxEngine.stop();
}, []);
```

**Input Handling:**
- Mouse click for attacks
- Mouse drag for ship placement
- Touch support for mobile
- Keyboard debug (Z key for admins - reveals opponent ships)

### PlayingPage.js

**Current Version:** v0.5.3  
**Line Count:** ~350 lines

**Purpose:** Battle UI orchestration

**Extracted Components (v0.5.0+):**
- useAutoPlay.js - Testing/debug utility
- useVideoTriggers.js - Video popup management

**Key Features:**
- View mode controls (fleet/attack/blended)
- Message console
- Fleet status sidebar
- Munitions display
- Statistics display
- Video popup integration

---

## CSS Architecture

### Hybrid BEM-DRY-KISS Philosophy

**Core Principle:** Share styling as much as possible for game-wide consistency. Don't create new class names unless absolutely necessary.

**BEM When Needed, DRY Always:**

```css
/* Block Element Modifier Pattern */
.btn { }                    /* Shared base */
.btn__icon { }              /* Element */
.btn--primary { }           /* Modifier when needed */
.btn--large { }             /* Modifier when needed */

/* But prefer sharing over creating modifiers */
.btn { /* styles work for 90% of buttons */ }
/* Only create .btn--special when truly different */
```

**Style Reuse Priority:**
1. Use existing classes first
2. Compose with utility classes second
3. Create new BEM classes only when necessary

**NEVER:**
- Inline styles: `style={{...}}`
- Camel case: `.btnPrimary`
- Underscores for modifiers: `.btn_primary`
- Create new classes for one-off styling
- Duplicate styles across files

**ALWAYS:**
- Reuse existing classes
- Check shared-components.css first
- Use CSS custom properties for theming
- Compose utilities before creating new classes

### File Structure & Load Order

**CRITICAL:** Styles must be imported in the correct order in `src/index.js`:

```javascript
// Import styles in correct order (CRITICAL)
import './index.css';                        // 1. Global resets first
import './styles/theme.css';                 // 2. Theme variables and base styles
import './styles/shared-components.css';     // 3. Shared component patterns
import './styles/modal-overlay.css';         // 4. Modal systems
import './styles/buttons.css';               // 5. Button system
import './styles/forms.css';                 // 6. Form components
import './styles/game-ui.css';               // 7. Game-specific UI
import './styles/utilities.css';             // 8. Utility classes
import './styles/stats.css';                 // 9. Stats page styles
import './styles/responsive.css';            // 10. Responsive adjustments (last)
```

**Why Order Matters:**
- Later files can override earlier files
- Utilities last = highest specificity
- Responsive last = proper breakpoint behavior
- Theme first = variables available everywhere

**File Purposes:**
```
src/styles/
├── theme.css              # CSS custom properties, typography, colors (v0.1.6)
├── shared-components.css  # Reusable component patterns (v1.1.1)
├── modal-overlay.css      # Modals, overlays, content panes (v1.0.4)
├── buttons.css            # Unified button system (v1.0.1)
├── forms.css              # Inputs, validation (v1.0.1)
├── game-ui.css            # Game-specific components (v2.2.4)
├── utilities.css          # Helper classes (v1.0.2)
├── stats.css              # Stats page specific (v0.1.0)
└── responsive.css         # All media queries (v1.0.5)
```

### Canvas Styling

**CanvasBoard Classes:**
```css
.canvas-board {
  display: block;
  max-width: 100%;
  max-height: 80vh;
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
}

/* Placement cursors */
.canvas-board--placement { cursor: move; }
.canvas-board--placement-empty { cursor: default; }

/* Battle cursors */
.canvas-board--battle { cursor: crosshair; }
.canvas-board--battle-waiting { cursor: wait; opacity: 0.7; }
```

### Responsive Design

**Mobile-First Approach:**
```css
/* Base (mobile) */
.btn { font-size: 0.875rem; padding: 0.5rem; }

/* Tablet */
@media (min-width: 768px) {
  .btn { font-size: 1rem; padding: 0.75rem; }
}

/* Desktop */
@media (min-width: 1024px) {
  .btn { font-size: 1.125rem; padding: 1rem; }
}
```

**Consolidated Breakpoints:**
- Mobile: < 768px
- Tablet: 768px - 1023px
- Desktop: ≥ 1024px

### Background System

**Era-Specific Backgrounds:**
- Loaded from era config `background_image` field
- Applied to `<body>` element
- No dark overlays
- Scrollable
- `.content-pane` provides readability overlays

---

## Monetization

### Freemium Model

**Free:**
- Traditional Battleship era (10x10)
- Unlimited AI gameplay
- Guest play support
- Full feature access

**Premium ($2.99 one-time):**
- Midway Island era (13x13, WWII)
- Advanced ship mechanics
- All future eras included
- Remove ads (future)

### Payment Flow

1. User selects premium era
2. Redirected to PurchasePage
3. Stripe Checkout integration
4. Payment processed
5. Rights granted via RightsService
6. User redirected to game

### Database Schema

```sql
CREATE TABLE user_rights (
  user_id UUID PRIMARY KEY,
  rights JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Rights JSON structure
{
  "eras": ["traditional", "midway"],
  "features": []
}
```

### Voucher System

**Self-Documenting Codes:**
```
midway-abc123    → Midway Island era unlock
pirates-xyz789   → Pirates of the Gulf era unlock
```

**One-Time Use:**
- Voucher deleted after redemption
- No sharing/resale
- Simple anti-fraud

---

## Development Standards

### Version Management

**File Headers:**
```javascript
// src/engines/CoreEngine.js
// Copyright(c) 2025, Clint H. O'Connor
// v0.6.10: Renamed resources to munitions for better semantics

const version = 'v0.6.10';
```

**Version Increment Rules:**
- Major: Breaking architectural changes (v1.0.0 → v2.0.0)
- Minor: New features, significant refactors (v1.0.0 → v1.1.0)
- Patch: Bug fixes, small changes (v1.0.0 → v1.0.1)

**Tracking:**
- Version in code content (`const version = ...`)
- Version in artifact titles
- Version in console logs
- Version in file header comments

### Code Quality Principles

1. **Single Source of Truth** - Statistics in Player.js, state in CoreEngine
2. **Turn-Based Architecture** - No realtime complexity
3. **Synchronous Core Logic** - Async only for I/O
4. **No Mapping Functions** - Services use domain objects directly
5. **Simpler is Better** - Choose simple over clever
6. **BEM CSS Methodology** - Consistent styling conventions
7. **No Inline Styles** - All styling in CSS files
8. **DRY Principle** - Duplicate code suggests need for abstraction
9. **Clear Interfaces** - Well-defined component contracts
10. **Observer Pattern** - Subscribe to changes, don't poll
11. **ID-Based Types** - Use ID prefix for guest/AI detection
12. **Dual Engine Design** - CoreEngine (logic) + UXEngine (presentation)
13. **Occam's Razor** - Simple, boring, working code beats clever abstractions
14. **File Size Discipline** - No file over 800 lines

### Refactoring Guidelines

**When to Extract:**
- File exceeds 800 lines
- Method exceeds 50 lines
- Class has multiple responsibilities
- Code is duplicated 3+ times
- Testing is difficult

**When NOT to Extract:**
- "It could be cleaner" without clear benefit
- Code is tightly coupled to parent
- Extraction adds more complexity than it removes
- "Because it's clever"

**Extraction Checklist:**
1. Does this solve a real problem? (size, complexity, duplication)
2. Will the extracted class have clear, single responsibility?
3. Will the interface be simpler than the implementation?
4. Can we test the extracted class independently?
5. Does the parent class become simpler?

**If any answer is "no", reconsider the extraction.**

### Critical Instructions

**NEVER:**
- Initialize statistics outside Player.js constructor
- Use inline styles (`style={{...}}`)
- Create new files without seeing current version
- Replace working code without understanding it
- Make architectural changes without seeing implementation
- Add realtime complexity to turn-based game
- Use legacy CSS class names in new code
- Apply dark gradient overlays to body backgrounds
- Use `skillLevel` or `skill_level` (removed in v0.4.3)
- Create separate FleetBattle/FleetPlacement components (use CanvasBoard)
- Make player attacks async (use synchronous execution)
- Trigger React re-renders from UXEngine loop
- Extract code "because it could be cleaner" without clear benefit

**ALWAYS:**
- Ask for existing code before modifying
- Increment version numbers properly
- Use BEM CSS methodology
- Preserve working functionality
- Understand interfaces before changing
- Choose simpler approaches
- Use CSS classes for all styling
- Check ID prefix for guest/AI detection
- Focus on 30-minute rich gameplay sessions
- Let content-pane provide readability overlays
- Use only `difficulty` (float) for AI configuration
- Use CanvasBoard for both placement and battle modes
- Execute player attacks synchronously for immediate particle effects
- Store props in refs for UXEngine access
- Keep CoreEngine synchronous, UXEngine asynchronous
- Justify extractions with concrete benefits

### Error Handling

**Defensive Programming:**
```javascript
// Validate required data
if (!this.eraConfig || !this.humanPlayer) {
  throw new Error('Missing required game data');
}

// Validate state transitions
const nextState = this.states[this.currentState]?.on[event];
if (!nextState) {
  throw new Error(`Invalid transition: ${this.currentState} + ${event}`);
}
```

**Console Logging:**
```javascript
// Use category prefixes for filtering
console.log('[CORE]', 'State transition:', oldState, '→', newState);
console.log('[GAME]', 'Attack result:', result);
console.log('[UX]', 'Rendering frame at 30fps');
console.log('[CANVAS]', 'Drawing overlay, viewMode:', viewMode);
console.log('[COMBAT]', 'Damage calculation:', damage);
```

---

## Appendix A: File Inventory

### Complete File List (v4.2)

**Total Files:** 81  
**Complete (version + EOF):** 77  
**Missing Version/EOF:** 4 (test files)

**Generation Date:** October 22, 2025, 14:02 BST

### Engine Layer (2 files)

- **CoreEngine.js** v0.6.10 (798 lines) - State machine orchestrator
- **UXEngine.js** v0.1.0 (~100 lines) - 30fps rendering loop

### Game Classes (11 files)

- **Game.js** v0.8.8 (679 lines) - Battle orchestrator
- **CombatResolver.js** v0.1.0 (~300 lines) - Combat mechanics ⭐ NEW
- **GameLifecycleManager.js** v0.2.3 (~280 lines) - Game lifecycle ⭐ EXPANDED
- **Player.js** v0.9.3 (~250 lines) - Base player
- **HumanPlayer.js** v0.1.0 (~50 lines) - Human player
- **AiPlayer.js** v0.5.0 (~280 lines) - AI opponent
- **Board.js** v0.4.0 (~220 lines) - Grid & terrain
- **Ship.js** v0.2.1 (~180 lines) - Vessel logic
- **Fleet.js** v0.2.0 (~150 lines) - Ship collection
- **Alliance.js** v0.1.2 (~100 lines) - Team coordination
- **Message.js** v0.1.5 (~120 lines) - Game messaging

### Utility Classes (7 files)

- **SessionManager.js** v0.1.0 (~150 lines) - Session storage ⭐ NEW
- **NavigationManager.js** v0.1.0 (~200 lines) - URL/browser nav ⭐ NEW
- **SoundManager.js** v0.1.0 (~40 lines) - Audio system ⭐ NEW
- **ConfigLoader.js** v1.1.0 (~120 lines) - Config loading
- **MessageHelper.js** v0.1.0 (~80 lines) - Message utilities
- **Debug.js** v0.1.3 (~60 lines) - Debug utilities
- **supabaseClient.js** v0.1.6 (~40 lines) - Database client

### Service Layer (6 files)

- **UserProfileService.js** v0.1.2 (~150 lines) - Profile CRUD
- **GameStatsService.js** v0.3.2 (~180 lines) - Statistics management
- **LeaderboardService.js** v0.1.5 (~120 lines) - Rankings
- **RightsService.js** v0.1.0 (~80 lines) - Era access
- **AchievementService.js** v0.2.0 (~150 lines) - Achievement tracking
- **StripeService.js** v0.1.0 (~60 lines) - Payment processing

### Renderers (3 files)

- **TerrainRenderer.js** v0.1.1 (~120 lines) - Cached terrain rendering
- **HitOverlayRenderer.js** v0.12.1 (~400 lines) - Fire/smoke system
- **AnimationManager.js** v0.1.0 (~150 lines) - Explosion particles

### Components (9 files)

- **CanvasBoard.js** v0.4.10 (~450 lines) - Unified canvas
- **NavBar.js** v0.2.9 (~200 lines) - Navigation bar
- **VideoPopup.js** v0.1.5 (~100 lines) - Video player
- **FleetStatusSidebar.js** v0.2.0 (~150 lines) - Fleet display
- **AchievementNotification.js** v0.1.0 (~80 lines) - Achievement popup
- **ActionMenu.js** v0.1.2 (~100 lines) - Action buttons
- **GameGuide.js** v0.1.0 (~120 lines) - Help overlay
- **InfoButton.js** v0.1.0 (~40 lines) - Info icon
- **InfoPanel.js** v0.1.0 (~80 lines) - Info display
- **LoginDialog.js** v0.1.40 (~300 lines) - Authentication
- **ProfileCreationDialog.js** v0.1.4 (~150 lines) - Profile creation
- **PromotionalBox.js** v0.2.0 (~100 lines) - Promotional content

### Pages (10 files)

- **LaunchPage.js** v0.3.8 (~200 lines) - Landing page
- **LoginPage.js** v0.3.6 (~150 lines) - Login flow
- **SelectEraPage.js** v0.5.2 (~300 lines) - Era selection
- **SelectOpponentPage.js** v0.6.1 (~350 lines) - Opponent selection
- **PlacementPage.js** v0.4.12 (~400 lines) - Ship placement
- **PlayingPage.js** v0.5.3 (~350 lines) - Battle UI
- **OverPage.js** v0.5.0 (~300 lines) - Game over results
- **StatsPage.js** v0.1.3 (~200 lines) - Player statistics
- **AchievementsPage.js** v0.1.1 (~150 lines) - Achievement display
- **PurchasePage.js** v0.4.3 (~250 lines) - Payment processing
- **ResetPasswordPage.js** v0.1.1 (~100 lines) - Password reset

### Context & Hooks (4 files)

- **GameContext.js** v0.4.5 (~200 lines) - React state management
- **useGameState.js** v0.3.2 (~120 lines) - Game state hook
- **useAutoPlay.js** v0.1.0 (~40 lines) - Autoplay utility ⭐ NEW
- **useVideoTriggers.js** v0.1.0 (~60 lines) - Video management ⭐ NEW

### Handlers (1 file)

- **InputHandler.js** v0.1.0 (~80 lines) - Input processing

### Styles (10 files)

- **theme.css** v0.1.6 - CSS custom properties
- **shared-components.css** v1.1.1 - Reusable patterns
- **modal-overlay.css** v1.0.4 - Modals & overlays
- **buttons.css** v1.0.1 - Button system
- **forms.css** v1.0.1 - Form components
- **game-ui.css** v2.2.4 - Game-specific UI
- **utilities.css** v1.0.2 - Helper classes
- **stats.css** v0.1.0 - Stats page
- **responsive.css** v1.0.5 - Media queries
- **PromotionalBox.css** v0.1.2 - Promotional styling

### Root Files (3 files)

- **App.js** v0.3.4 (~150 lines) - Root component
- **App.css** v0.5.1 - App-level styles
- **index.js** v0.1.3 (~40 lines) - Entry point
- **index.css** v0.1.1 - Global resets

### Scripts (4 files)

- **list-versions.js** v0.1.9 - Version inventory generator
- **vouchers.js** v0.2.1 - Voucher management
- **era-configs-update.js** v0.1.5 - Config updates

### Netlify Functions (3 files)

- **create_payment_intent.js** v0.1.0 - Stripe payment
- **get_price_info.js** v0.2.0 - Price fetching
- **stripe_webhook.js** v0.1.1 - Webhook handler

---

## Appendix B: Refactoring Timeline

### October 19-22, 2025: The Great Refactoring

**Day 1: CoreEngine Phase 1**
- v0.6.4: Extracted SessionManager (~150 lines)
- Git tag: `v0.6.4-session-manager`

**Day 2: CoreEngine Phase 2**
- v0.6.6: Extracted NavigationManager (~200 lines)
- Added helper methods for NavigationManager
- Git tag: `v0.6.6-navigation-manager`

**Day 3: CoreEngine Phase 3**
- v0.6.7: Delegated to GameLifecycleManager (~114 lines)
- v0.6.8: Removed service wrapper methods (~35 lines)
- v0.6.9: Moved game logic to Game.js (~30 lines)
- Git tag: `v0.6.7-lifecycle-manager`

**Day 4: Game.js Refactoring**
- v0.8.4: Extracted CombatResolver (~300 lines, removed 214-line monster!)
- v0.8.5: Extracted SoundManager (~40 lines)
- v0.8.6: Extracted GameLifecycleManager end-game logic (~131 lines)
- Git tags: `v0.8.4-combat-resolver`, `v0.8.5-sound-manager`, `v0.8.6-lifecycle-manager`

**Day 5: Munitions & Polish**
- v0.6.10: CoreEngine - Renamed resources → munitions
- v0.8.7-v0.8.8: Game.js - Added munitions management
- v0.3.2: useGameState - Exposed munitions
- v0.5.3: PlayingPage - Extracted useAutoPlay, useVideoTriggers
- Git tag: `v0.8.8-game-complete`

**Final Status:**
- CoreEngine: 1062 → 798 lines (264 lines removed, 25% reduction)
- Game.js: 1002 → 679 lines (323 lines removed, 32% reduction)
- **Total:** 2064 → 1477 lines (587 lines removed, 28% reduction)
- 5 new utility classes
- 2 new custom hooks
- No file over 800 lines
- No method over 50 lines

---

## Appendix C: Coordinate System

### Computer Graphics Reference Frame

The game uses standard computer graphics coordinates (NOT Cartesian/mathematical):

- **(0,0) is top-left corner**
- **Y increases downward** (not upward)
- **Canvas rotation goes clockwise** (not counter-clockwise)
- **X increases rightward** (same as Cartesian)

**Historical Context:**
This coordinate system originated from CRT raster scan technology. The electron beam would scan from top-left, moving right then down, which became the standard for all computer graphics.

**Orientation Degrees:**
- **0°** = Horizontal right → (stern left, bow right)
- **90°** = Vertical down ↓ (90° clockwise from 0°)
- **180°** = Horizontal left ← (180° from 0°)
- **270°** = Vertical up ↑ (270° clockwise from 0°, or 90° counter-clockwise)

**Why This Matters:**
Counterintuitive compared to nautical/compass bearings (where 0° = North/up) and mathematical coordinates. Ship placement and rendering code must use computer graphics convention consistently.

---

## Appendix D: Competitive Game Design

### What Makes Games Viral and Compelling

From analyzing successful competitive games like Candy Crush, League of Legends, and modern strategy games, certain patterns emerge that drive engagement, retention, and virality.

### Core Viral Mechanics

**1. Easy to Learn, Hard to Master**
- **Principle:** Simple core mechanics anyone can understand in 30 seconds
- **Depth:** Strategic complexity emerges over time
- **Battle for Oceans:** ✅ Classic Battleship instantly familiar, progressive fog of war adds depth

**2. Short Session, Long Engagement**
- **Principle:** "Just one more game" feeling - sessions under 30 minutes
- **Battle for Oceans:** ✅ 20-30 minute sessions perfect for "lunch break gaming"

**3. Visible Progress & Mastery**
- **Principle:** Players see themselves improving
- **Battle for Oceans:** ✅ Leaderboards, accuracy tracking, achievement system

**4. Social Proof & Competition**
- **Principle:** Players want to compare themselves to others
- **Battle for Oceans:** ✅ Leaderboards with percentile rankings

**5. Varied Challenges**
- **Principle:** Content feels fresh each session
- **Battle for Oceans:** ✅ Multiple AI personalities, different eras, varied board sizes

### Elements From Candy Crush Model

**What's Suitable for Battle for Oceans:**

✅ **GOOD FIT:**
- Daily challenges with achievement badges
- Visual juiciness (emoji fire 🔥, smoke 💨) - IMPLEMENTED
- Level progression (unlock new eras) - IMPLEMENTED
- Social sharing (victory screenshots)
- Achievement system - IMPLEMENTED

❌ **BAD FIT:**
- Lives/Energy system (frustrates strategy players)
- Pay-to-win power-ups (destroys competitive integrity)
- Social spam notifications
- Time gates (kills momentum)

### Implementation Priorities

**Phase 1 (Launch) - COMPLETE:**
- ✅ Leaderboards with percentile rankings
- ✅ Achievement badges (database ready)
- ✅ Multiple AI personalities
- ✅ Clean, juicy animations

**Phase 2 (Post-Launch) - PLANNED:**
- Weekly challenges
- Victory screenshot sharing
- AI personality unlocking
- Perfect game streak tracking

**Phase 3 (Growth) - FUTURE:**
- Seasonal leaderboards
- Spectator mode / replays
- Cosmetic ship skins
- Training mode with AI commentary

### Key Takeaway

**Battle for Oceans focuses on:**
- ✅ Competitive integrity (no pay-to-win)
- ✅ Strategic depth (reward skill and learning)
- ✅ Social comparison (leaderboards, sharing)
- ✅ Visual satisfaction (smooth animations)
- ✅ Respect player time (30-minute sessions)

**Avoids:**
- ❌ Predatory monetization
- ❌ Social spam
- ❌ Complexity creep
- ❌ Pay-to-win mechanics

---

## Conclusion

Game Bible v4.2 documents the **completed refactoring** of Battle for the Oceans' core architecture, achieving significant improvements in code quality, maintainability, and architectural clarity.

**Key Achievements:**

1. ✅ **Major Refactoring Complete**
   - CoreEngine: 1062 → 798 lines (25% reduction)
   - Game.js: 1002 → 679 lines (32% reduction)
   - Total: 587 lines removed (28% reduction)

2. ✅ **5 New Utility Classes**
   - SessionManager - Session persistence
   - NavigationManager - URL/browser navigation
   - SoundManager - Audio system
   - CombatResolver - Combat mechanics
   - GameLifecycleManager - Game lifecycle (expanded)

3. ✅ **2 New Custom Hooks**
   - useAutoPlay - Testing utility
   - useVideoTriggers - Video management

4. ✅ **Architectural Goals Met**
   - No file over 800 lines
   - No method over 50 lines (214-line monster eliminated!)
   - Clear single responsibilities
   - Easy to test and maintain

5. ✅ **Munitions System**
   - Renamed from "resources" for better semantics
   - Extensible for future types
   - Clean integration with game logic

6. ✅ **Development Standards**
   - Occam's Razor applied consistently
   - "Simple beats clever" philosophy
   - Every extraction justified by complexity
   - No over-abstraction

**What's Next:**

The refactoring phase is complete. Focus now shifts to:
- Feature development (scatter shot, etc.)
- Pirates of the Gulf era implementation
- Mobile responsiveness polish
- Achievement UI completion
- Marketing and launch preparation

**Recommended Development Sequence:**
1. Polish current munitions UI
2. Implement scatter shot munition
3. Add weekly challenges system
4. Work on Pirates of the Gulf era
5. Mobile app consideration
6. Launch marketing campaign

This architecture provides a **solid, maintainable foundation** for long-term development while maintaining the **accessibility and strategic depth** that made the original Battleship game timeless.

---

*End of Game Bible v4.2*  
*October 2025*  
*Refactoring Complete - Ready for Feature Development*
