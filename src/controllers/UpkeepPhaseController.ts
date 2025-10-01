/**
 * UpkeepPhaseController - Handles settlement feeding, military support, and build processing
 * 
 * NEW: Uses simplified step array system with feed-settlements, support-military, and process-builds steps.
 * Resource decay has been moved to StatusPhaseController (beginning of turn).
 */

import { getKingdomActor } from '../stores/KingdomStore';
import { get } from 'svelte/store';
import { 
  reportPhaseStart, 
  reportPhaseComplete, 
  reportPhaseError, 
  createPhaseResult,
  initializePhaseSteps,
  completePhaseStep,
  isStepCompleted
} from './shared/PhaseControllerHelpers';

// Define steps for Upkeep Phase
const UPKEEP_PHASE_STEPS = [
  { id: 'feed-settlements', name: 'Feed Settlements' },
  { id: 'support-military', name: 'Support Military' },
  { id: 'process-builds', name: 'Process Build Queue' }
];

export async function createUpkeepPhaseController() {
  return {
    async startPhase() {
      reportPhaseStart('UpkeepPhaseController');
      
      try {
        // Initialize phase with predefined steps
        await initializePhaseSteps(UPKEEP_PHASE_STEPS);
        
        // Auto-mark skipped steps as complete (only when there's nothing to process)
        const { kingdomData } = await import('../stores/KingdomStore');
        const kingdom = get(kingdomData);
        
        // Auto-complete military support ONLY if no armies
        const armyCount = kingdom.armies?.length || 0;
        if (armyCount === 0) {
          await completePhaseStep('support-military');
          console.log('✅ [UpkeepPhaseController] Military support auto-completed (no armies)');
        }
        
        // Auto-complete build queue ONLY if no projects
        const buildQueueCount = kingdom.buildQueue?.length || 0;
        if (buildQueueCount === 0) {
          await completePhaseStep('process-builds');
          console.log('✅ [UpkeepPhaseController] Build queue auto-completed (no projects)');
        }
        
        // Settlement feeding is NEVER auto-completed - always requires user interaction
        console.log('🟡 [UpkeepPhaseController] Settlement feeding requires manual completion');
        
        reportPhaseComplete('UpkeepPhaseController');
        return createPhaseResult(true);
      } catch (error) {
        reportPhaseError('UpkeepPhaseController', error instanceof Error ? error : new Error(String(error)));
        return createPhaseResult(false, error instanceof Error ? error.message : 'Unknown error');
      }
    },

    /**
     * Feed settlements step
     */
    async feedSettlements() {
      if (isStepCompleted('feed-settlements')) {
        return createPhaseResult(false, 'Settlements already fed this turn');
      }

      try {
        console.log('🍞 [UpkeepPhaseController] Processing settlement feeding...');
        await this.processFoodConsumption();
        
        // Complete the feed-settlements step
        await completePhaseStep('feed-settlements');
        
        return createPhaseResult(true);
      } catch (error) {
        return createPhaseResult(false, error instanceof Error ? error.message : 'Unknown error');
      }
    },

    /**
     * Support military step
     */
    async supportMilitary() {
      if (isStepCompleted('support-military')) {
        return createPhaseResult(false, 'Military already supported this turn');
      }

      try {
        console.log('�️ [UpkeepPhaseController] Processing military support...');
        await this.processMilitarySupport();
        
        // Complete the support-military step
        await completePhaseStep('support-military');
        
        return createPhaseResult(true);
      } catch (error) {
        return createPhaseResult(false, error instanceof Error ? error.message : 'Unknown error');
      }
    },

    /**
     * Process build queue step
     */
    async processBuilds() {
      if (isStepCompleted('process-builds')) {
        return createPhaseResult(false, 'Build queue already processed this turn');
      }

      try {
        console.log('🏗️ [UpkeepPhaseController] Processing build queue...');
        await this.processBuildProjects();
        
        // Complete the process-builds step
        await completePhaseStep('process-builds');
        
        return createPhaseResult(true);
      } catch (error) {
        return createPhaseResult(false, error instanceof Error ? error.message : 'Unknown error');
      }
    },

    /**
     * Process food consumption for settlements
     */
    async processFoodConsumption() {
      const { kingdomData } = await import('../stores/KingdomStore');
      const { calculateConsumption } = await import('../services/economics/consumption');
      const kingdom = get(kingdomData);
      
      // Use proper consumption service with settlement tier-based calculations
      const settlements = kingdom.settlements || [];
      const armies = kingdom.armies || [];
      const consumption = calculateConsumption(settlements, armies);
      const currentFood = kingdom.resources?.food || 0;
      
      const actor = getKingdomActor();
      if (!actor) {
        console.error('❌ [UpkeepPhaseController] No KingdomActor available');
        return;
      }
      
      if (currentFood >= consumption.totalFood) {
        // Sufficient food - mark all settlements as fed
        await actor.updateKingdom((kingdom) => {
          kingdom.resources.food = currentFood - consumption.totalFood;
          kingdom.settlements.forEach(settlement => {
            settlement.wasFedLastTurn = true;
          });
        });
        
        console.log(`🍞 [UpkeepPhaseController] Consumed ${consumption.totalFood} food (${consumption.settlementFood} settlements + ${consumption.armyFood} armies)`);
        console.log(`✅ [UpkeepPhaseController] All ${settlements.length} settlements fed successfully`);
      } else {
        // Food shortage - generate unrest and mark settlements as unfed
        const shortage = consumption.totalFood - currentFood;
        await actor.updateKingdom((kingdom) => {
          kingdom.resources.food = 0;
          kingdom.unrest += shortage;
          kingdom.settlements.forEach(settlement => {
            settlement.wasFedLastTurn = false;
          });
        });
        
        console.log(`⚠️ [UpkeepPhaseController] Food shortage: ${shortage} unrest generated (needed ${consumption.totalFood}, had ${currentFood})`);
        console.log(`❌ [UpkeepPhaseController] ${settlements.length} settlements unfed - will not generate gold next turn`);
      }
    },

    /**
     * Process military support costs
     */
    async processMilitarySupport() {
      const { kingdomData } = await import('../stores/KingdomStore');
      const kingdom = get(kingdomData);
      
      const armyCount = kingdom.armies?.length || 0;
      if (armyCount === 0) {
        console.log('🛡️ [UpkeepPhaseController] No armies to support');
        return;
      }
      
      const actor = getKingdomActor();
      if (!actor) {
        console.error('❌ [UpkeepPhaseController] No KingdomActor available');
        return;
      }
      
      // Simple military support cost
      const supportCost = armyCount;
      const currentGold = kingdom.resources?.gold || 0;
      
      if (currentGold >= supportCost) {
        await actor.updateKingdom((kingdom) => {
          kingdom.resources.gold = currentGold - supportCost;
        });
        console.log(`💰 [UpkeepPhaseController] Paid ${supportCost} gold for military support`);
      } else {
        // Can't afford support - generate unrest
        const shortage = supportCost - currentGold;
        await actor.updateKingdom((kingdom) => {
          kingdom.resources.gold = 0;
          kingdom.unrest += shortage;
        });
        console.log(`⚠️ [UpkeepPhaseController] Military support shortage: ${shortage} unrest generated`);
      }
    },

    /**
     * Process build queue projects
     */
    async processBuildProjects() {
      const { kingdomData } = await import('../stores/KingdomStore');
      const kingdom = get(kingdomData);
      
      const buildQueue = kingdom.buildQueue || [];
      if (buildQueue.length === 0) {
        console.log('🏗️ [UpkeepPhaseController] No build projects to process');
        return;
      }
      
      const actor = getKingdomActor();
      if (!actor) {
        console.error('❌ [UpkeepPhaseController] No KingdomActor available');
        return;
      }
      
      // Actually process and remove completed projects from the queue
      await actor.updateKingdom((kingdom) => {
        const completedProjects = [...kingdom.buildQueue];
        kingdom.buildQueue = []; // Clear the queue - projects are completed
        
        console.log(`🏗️ [UpkeepPhaseController] Completed ${completedProjects.length} build projects:`, 
          completedProjects.map(p => p.structureId));
      });
      
      console.log(`✅ [UpkeepPhaseController] Processed ${buildQueue.length} build projects`);
    },

    /**
     * Get display data for the UI
     */
    async getDisplayData(kingdomData: any) {
      if (!kingdomData) {
        return {
          currentFood: 0,
          foodConsumption: 0,
          foodShortage: 0,
          settlementConsumption: 0,
          armyConsumption: 0,
          armyCount: 0,
          armySupport: 0,
          unsupportedCount: 0,
          foodRemainingForArmies: 0,
          armyFoodShortage: 0,
          settlementFoodShortage: 0,
          stepsCompleted: {
            feedSettlements: false,
            supportMilitary: false,
            processBuilds: false
          }
        };
      }

      // Use proper consumption service
      const { calculateConsumption, calculateArmySupportCapacity, calculateUnsupportedArmies } = await import('../services/economics/consumption');
      
      const settlements = kingdomData.settlements || [];
      const armies = kingdomData.armies || [];
      const consumption = calculateConsumption(settlements, armies);
      const armySupport = calculateArmySupportCapacity(settlements);
      const unsupportedCount = calculateUnsupportedArmies(armies, settlements);
      
      const currentFood = kingdomData.resources?.food || 0;
      const armyCount = armies.length;
      
      const foodRemainingForArmies = Math.max(0, currentFood - consumption.settlementFood);
      const settlementFoodShortage = Math.max(0, consumption.settlementFood - currentFood);
      const armyFoodShortage = Math.max(0, consumption.armyFood - foodRemainingForArmies);
      
      return {
        currentFood,
        foodConsumption: consumption.totalFood,
        foodShortage: Math.max(0, consumption.totalFood - currentFood),
        settlementConsumption: consumption.settlementFood,
        armyConsumption: consumption.armyFood,
        armyCount,
        armySupport,
        unsupportedCount,
        foodRemainingForArmies,
        armyFoodShortage,
        settlementFoodShortage,
        stepsCompleted: {
          feedSettlements: isStepCompleted('feed-settlements'),
          supportMilitary: isStepCompleted('support-military'),
          processBuilds: isStepCompleted('process-builds')
        }
      };
    }
  };
}
