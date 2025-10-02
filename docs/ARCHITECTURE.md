# PF2e Reignmaker - Architecture Guide

**Last Updated:** October 1, 2025

## Overview

PF2e Reignmaker is a Foundry VTT module implementing kingdom management mechanics for Pathfinder 2e. The architecture uses **KingdomActor as the single source of truth** with **reactive Svelte stores as read-only bridges** for UI components.

## Core Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Foundry VTT Integration                     │
├─────────────────────────────────────────────────────────────────┤
│                     View Layer (Svelte)                        │
│                 ↕ (Reactive Subscriptions)                     │
├─────────────────────────────────────────────────────────────────┤
│                 Reactive Store Bridge Layer                    │
│    kingdomData, currentTurn, resources, etc. (READ-ONLY)       │
│                 ↕ (Derived from KingdomActor)                  │
├─────────────────────────────────────────────────────────────────┤
│                    KingdomActor (Single Source of Truth)       │
│                      ↕ (All writes go here)                    │
├─────────────────────────────────────────────────────────────────┤
│                    Foundry VTT Persistence                     │
└─────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. KingdomActor (`src/actors/KingdomActor.ts`)
**Role:** Single source of truth for all kingdom data

**Key Methods:**
```typescript
// Data access
getKingdom(): KingdomData | null

// Data mutations (ALL writes go here)
updateKingdom(updater: (kingdom: KingdomData) => void): Promise<void>
modifyResource(resource: string, amount: number): Promise<void>
setResource(resource: string, amount: number): Promise<void>
markPhaseStepCompleted(stepId: string): Promise<void>
addSettlement(settlement: Settlement): Promise<void>
```

### 2. Reactive Store Bridge (`src/stores/KingdomStore.ts`)
**Role:** Read-only reactive bridge between KingdomActor and UI

**Available Stores:**
```typescript
// Core stores
export const kingdomActor = writable<KingdomActor | null>(null);
export const kingdomData = derived(kingdomActor, $actor => $actor?.getKingdom());

// Convenience derived stores (all READ-ONLY)
export const currentTurn = derived(kingdomData, $data => $data.currentTurn);
export const currentPhase = derived(kingdomData, $data => $data.currentPhase);
export const resources = derived(kingdomData, $data => $data.resources);
export const fame = derived(kingdomData, $data => $data.fame);
export const unrest = derived(kingdomData, $data => $data.unrest);
```

**Write Functions (delegate to KingdomActor):**
```typescript
export async function updateKingdom(updater: (kingdom: KingdomData) => void)
export async function setResource(resource: string, amount: number)
export async function modifyResource(resource: string, amount: number)
```

### 3. TurnManager (`src/models/turn-manager/`)
**Role:** Central coordinator with modular architecture

**Structure:**
```
src/models/turn-manager/
├── index.ts          # Clean module exports
├── TurnManager.ts    # Main coordinator (turn/phase progression, player actions)
└── phase-handler.ts  # Step management utilities (imported by TurnManager)
```

**TurnManager Key Methods:**
```typescript
// Turn and phase progression
async nextPhase(): Promise<void>
async endTurn(): Promise<void>
async skipToPhase(phase: TurnPhase): Promise<void>

// Phase step management (delegates to PhaseHandler)
async initializePhaseSteps(steps: Array<{ name: string }>): Promise<void>
async completePhaseStepByIndex(stepIndex: number): Promise<{ phaseComplete: boolean }>
async isStepCompletedByIndex(stepIndex: number): Promise<boolean>

// Player action management
spendPlayerAction(playerId: string, phase: TurnPhase): boolean
resetPlayerAction(playerId: string): void

// Utility functions
async canPerformAction(actionId: string): Promise<boolean>
async getUnrestPenalty(): Promise<number>
async spendFameForReroll(): Promise<boolean>
```

**PhaseHandler Utilities:**
```typescript
// Step initialization and completion logic
static async initializePhaseSteps(steps: Array<{ name: string }>): Promise<void>
static async completePhaseStepByIndex(stepIndex: number): Promise<StepCompletionResult>
static async isStepCompletedByIndex(stepIndex: number): Promise<boolean>
static async isCurrentPhaseComplete(): Promise<boolean>
```

**Important:** TurnManager does NOT trigger phase controllers. Phases are self-executing when mounted.

### 4. Phase Controllers (`src/controllers/*PhaseController.ts`)
**Role:** Execute phase-specific business logic

**Key Pattern:**
```typescript
export async function createPhaseController() {
  return {
    async startPhase() {
      console.log('🟡 [PhaseController] Starting phase...');
      try {
        await this.doPhaseWork();
        await markPhaseStepCompleted('phase-complete');
        await this.notifyPhaseComplete();
        console.log('✅ [PhaseController] Phase complete');
        return { success: true };
      } catch (error) {
        console.error('❌ [PhaseController] Phase failed:', error);
        return { success: false, error: error.message };
      }
    }
  };
}
```

### 5. Phase Components (`src/view/kingdom/turnPhases/*.svelte`)
**Role:** Mount when active, auto-start phase execution

**Key Pattern:**
```svelte
<script>
onMount(async () => {
  if ($kingdomData.currentPhase === OUR_PHASE && !isCompleted) {
    const controller = await createPhaseController();
    await controller.startPhase();
  }
});
</script>
```

## Data Flow Pattern

### **Golden Rule: Read from Bridge, Write to Source**

#### Read Path (Reactive):
```
KingdomActor → kingdomData store → Component Display
```

#### Write Path (Actions):
```
Component Action → Controller → KingdomActor → Foundry → All Clients Update
```

#### Phase Execution Flow:
```
TurnManager.nextPhase() → Update currentPhase → 
Component Mounts → controller.startPhase() → Execute Logic
```

**Key Change:** TurnManager no longer triggers controllers. Phases are self-executing when mounted.

## Development Patterns

### 1. Component Implementation (Presentation Only)

```svelte
<script>
// ✅ READ from reactive bridge
import { kingdomData, fame, resources } from '../stores/KingdomStore';

// ✅ UI State only
let isProcessing = false;
let errorMessage = '';

// ✅ Reactive display logic
$: currentFame = $fame;
$: currentGold = $resources.gold;
$: canAffordFame = $resources.gold >= 100;

// ✅ UI calls controller - NO business logic here
async function buyFame() {
  if (isProcessing) return;
  
  isProcessing = true;
  errorMessage = '';
  
  try {
    // Delegate ALL business logic to controller
    const { createEconomyController } = await import('../controllers/EconomyController');
    const controller = await createEconomyController();
    
    const result = await controller.purchaseFame(100);
    
    if (!result.success) {
      errorMessage = result.error || 'Purchase failed';
    }
  } catch (error) {
    errorMessage = 'Error processing purchase';
    console.error('❌ [Component] Fame purchase failed:', error);
  } finally {
    isProcessing = false;
  }
}
</script>

<!-- ✅ Presentation only -->
<div class="fame-section">
  <p>Fame: {$fame}</p>
  <p>Gold: {$resources.gold}</p>
  
  {#if errorMessage}
    <div class="error">{errorMessage}</div>
  {/if}
  
  <button 
    on:click={buyFame} 
    disabled={isProcessing || !canAffordFame}
    class:processing={isProcessing}
  >
    {#if isProcessing}
      <i class="fas fa-spinner fa-spin"></i>
      Processing...
    {:else}
      Buy Fame (100 gold)
    {/if}
  </button>
</div>
```

### 2. Phase Implementation (Self-Executing Pattern)

**Controller:**
```typescript
export async function createPhaseController() {
  return {
    async startPhase() {
      console.log('🟡 [PhaseController] Starting phase...');
      try {
        // Execute phase-specific business logic
        await this.doPhaseWork();
        await markPhaseStepCompleted('phase-complete');
        
        // Notify completion
        await this.notifyPhaseComplete();
        console.log('✅ [PhaseController] Phase complete');
        return { success: true };
      } catch (error) {
        console.error('❌ [PhaseController] Phase failed:', error);
        return { success: false, error: error.message };
      }
    },
    
    async notifyPhaseComplete() {
      const { turnManager } = await import('../stores/turn');
      const manager = get(turnManager);
      if (manager) {
        await manager.markCurrentPhaseComplete();
      }
    }
  };
}
```

**Component:**
```svelte
<script>
onMount(async () => {
  // Only start if we're in the correct phase and haven't run yet
  if ($kingdomData.currentPhase === OUR_PHASE && !isCompleted) {
    const controller = await createPhaseController();
    await controller.startPhase();
  }
});
</script>
```

### 3. Adding New Features

#### For UI Components:
1. **Presentation only** - handle user interaction, display data, manage UI state
2. **Subscribe to reactive stores** for data display
3. **Delegate to controllers** - never implement business logic directly
4. **Handle UI errors gracefully** - show user-friendly messages

#### For Controllers:
1. **Business logic only** - implement game rules, phase operations, calculations
2. **Return results** - use `{ success: boolean, error?: string }` pattern
3. **Use clear console logging** - for debugging transparency
4. **No UI concerns** - don't manage UI state or presentation

#### For Services:
1. **Complex operations** - calculations, integrations, utilities
2. **Reusable logic** - shared between multiple controllers
3. **Stateless when possible** - easier to test and reason about

## Key Principles

### 1. Single Source of Truth
- KingdomActor is the ONLY persistent data source
- All writes go through KingdomActor methods
- Stores are derived/reactive, never written to directly

### 2. Reactive Bridge Pattern
- Stores provide reactive access, not data storage
- Components read from stores, write to KingdomActor
- Automatic updates when KingdomActor changes

### 3. Business Logic Separation
- **Svelte components are for presentation only** - UI, user interaction, display logic
- **Controllers handle business logic** - phase operations, data manipulation, game rules
- **Services handle complex operations** - calculations, integrations, utilities
- **No business logic in Svelte files** - components delegate to controllers/services

### 4. Phase Management Pattern
- **TurnManager** = ONLY turn/phase progression (no orchestration)
- **Phase Components** = Mount when active, call `controller.startPhase()` 
- **Phase Controllers** = Execute phase business logic, mark completion
- **NO triggering from TurnManager** - phases are self-executing when mounted

### 5. Direct Simplicity
- Direct function calls instead of complex patterns
- Simple async operations
- Clear console logging with emoji indicators
- Minimal abstractions, maximum clarity
- Use `startPhase()` not misleading names like "automation"

### 5. Foundry-First Design
- Use actor flags for persistence
- Use Foundry hooks for reactivity
- Use Foundry's networking for multiplayer sync

## Event & Incident System

### Data Structure (Normalized)

All events and incidents use a standardized structure stored in `dist/events.json` and `dist/incidents.json`:

```typescript
interface KingdomEvent {
  id: string;
  name: string;
  description: string;
  tier: number;  // All start at tier 1
  skills: EventSkill[];  // Flat structure
  effects: {  // Consolidated outcomes
    criticalSuccess?: { msg: string, modifiers: EventModifier[] },
    success?: { msg: string, modifiers: EventModifier[] },
    failure?: { msg: string, modifiers: EventModifier[] },
    criticalFailure?: { msg: string, modifiers: EventModifier[] }
  };
  ifUnresolved?: UnresolvedEvent;  // Becomes modifier if failed/ignored
}
```

**Key Changes from Old System:**
- ✅ Removed: `escalation`, `priority`, `severity`, fixed DCs
- ✅ Simplified: `stages` → flat `skills` array
- ✅ Standardized: All outcomes use `EventModifier[]` format
- ✅ Duration: Only in modifiers, not at event level
- ✅ DC: Level-based only (no fixed values)

### Modifier System (Simplified)

**Storage Location:** `kingdom.activeModifiers: ActiveModifier[]` in KingdomActor

**ActiveModifier Structure:**
```typescript
interface ActiveModifier {
  id: string;
  name: string;
  description: string;
  icon?: string;
  tier: number;
  
  // Source tracking
  sourceType: 'event' | 'incident' | 'structure';
  sourceId: string;
  sourceName: string;
  
  // Timing
  startTurn: number;
  
  // Effects (uses EventModifier format)
  modifiers: EventModifier[];
  
  // Resolution (optional)
  resolvedWhen?: ResolutionCondition;
}
```

**ModifierService Pattern:**
```typescript
// Create service instance
const modifierService = await createModifierService();

// Create modifier from unresolved event
const modifier = modifierService.createFromUnresolvedEvent(event, currentTurn);

// Add to KingdomActor directly
await updateKingdom(kingdom => {
  if (!kingdom.activeModifiers) kingdom.activeModifiers = [];
  kingdom.activeModifiers.push(modifier);
});

// Apply during Status phase
await modifierService.applyOngoingModifiers();

// Clean up expired modifiers
await modifierService.cleanupExpiredModifiers();
```

**Integration Points:**
1. **EventPhaseController** - Creates modifiers for failed/ignored events
2. **UnrestPhaseController** - Creates modifiers for unresolved incidents
3. **StatusPhaseController** - Applies ongoing modifiers each turn
4. **ModifierService** - Handles creation, application, cleanup

**Key Simplifications:**
- NO complex priority/escalation logic
- Direct array manipulation via `updateKingdom()`
- Simple turn-based or ongoing duration
- Straightforward application during Status phase

## File Organization

```
src/
├── actors/              # KingdomActor (single source of truth)
├── models/              # TurnManager, Modifiers (data structures)
├── stores/              # KingdomStore - Reactive bridge stores (read-only)
├── view/                # Svelte components (read from stores, write to actor)
├── controllers/         # Simple phase controllers (direct implementation)
│   ├── events/          # Event types & providers
│   ├── incidents/       # Incident types & providers
│   └── shared/          # Shared controller utilities
├── services/            # Business logic services
│   ├── domain/          # Domain services (events, incidents, unrest)
│   │   ├── events/      # EventService (load from dist/events.json)
│   │   └── incidents/   # IncidentService (load from dist/incidents.json)
│   ├── pf2e/            # PF2e integration services
│   └── ModifierService.ts  # Simplified modifier management
└── types/               # TypeScript definitions
```

## Common Operations

### Reading Data:
```typescript
import { kingdomData, fame, resources } from '../stores/KingdomStore';

// Reactive access
$: currentFame = $fame;
$: goldAmount = $resources.gold;
```

### Writing Data:
```typescript
import { updateKingdom, setResource } from '../stores/KingdomStore';

// Simple resource update
await setResource('fame', 10);

// Complex update
await updateKingdom(kingdom => {
  kingdom.resources.gold -= 50;
  kingdom.fame += 1;
  kingdom.unrest = Math.max(0, kingdom.unrest - 1);
});
```

### Phase Completion:
```typescript
import { markPhaseStepCompleted } from '../stores/KingdomStore';

// Mark step complete
await markPhaseStepCompleted('resource-collection');

// Tell TurnManager phase is done
const { turnManager } = await import('../stores/turn');
await get(turnManager).markCurrentPhaseComplete();
```

## Error Handling

- Use clear console logging with emoji indicators
- Simple try/catch blocks with meaningful error messages
- Direct error handling without complex orchestration

## Testing Approach

- Test KingdomActor operations directly
- Test component reactivity with mock KingdomActor
- Test turn progression with simple scenarios
- Direct operations testing

---

This architecture provides a clean, maintainable system that leverages Foundry's strengths while keeping the code simple and understandable.
