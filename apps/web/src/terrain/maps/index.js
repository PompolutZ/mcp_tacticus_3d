// Map layouts from the TTS mod's "Terrain Database", one JSON file per map. The format is in
// docs/features/maps.md. The pieces are in ../pieces.js. The order of the imports is the order of the maps.
import vibraniumHeist from './vibranium-heist.json' with { type: 'json' }
import battleForAsgard from './battle-for-asgard.json' with { type: 'json' }
import hydraVsWakanda from './hydra-vs-wakanda.json' with { type: 'json' }
import dimensionalAssault from './dimensional-assault.json' with { type: 'json' }
import darkDimensionOnMarsBase from './dark-dimension-on-mars-base.json' with { type: 'json' }
import willHeGetAwayWithIt from './will-he-get-away-with-it.json' with { type: 'json' }
import savagelandUnleashed from './savageland-unleashed.json' with { type: 'json' }
import oldTownRoad from './old-town-road.json' with { type: 'json' }
import hellsKitchen from './hells-kitchen.json' with { type: 'json' }
import poolPartyAtTheMansion from './pool-party-at-the-mansion.json' with { type: 'json' }
import demonsDowntown from './demons-downtown.json' with { type: 'json' }
import cosmicDowntown from './cosmic-downtown.json' with { type: 'json' }
import busyCityDisturbed from './busy-city-disturbed.json' with { type: 'json' }
import savageLandResearchSite from './savage-land-research-site.json' with { type: 'json' }
import sunkShipShelteringSinisterSecrets from './sunk-ship-sheltering-sinister-secrets.json' with { type: 'json' }
import sinisterShowdown from './sinister-showdown.json' with { type: 'json' }
import oscropChemical from './oscrop-chemical.json' with { type: 'json' }
import aHulkCornered from './a-hulk-cornered.json' with { type: 'json' }
import dockyardDestructionSpiderManToBlame from './dockyard-destruction-spider-man-to-blame.json' with { type: 'json' }
import nightTimePatrol from './night-time-patrol.json' with { type: 'json' }
import sandScrap from './sand-scrap.json' with { type: 'json' }
import swingIntoAction from './swing-into-action.json' with { type: 'json' }

// Mat top in TTS: the mat tile sits at y = 0.96 and is 0.1 thick
export const TTS_MAT_TOP = 1.06

export const MAPS = Object.fromEntries(
  [
    vibraniumHeist,
    battleForAsgard,
    hydraVsWakanda,
    dimensionalAssault,
    darkDimensionOnMarsBase,
    willHeGetAwayWithIt,
    savagelandUnleashed,
    oldTownRoad,
    hellsKitchen,
    poolPartyAtTheMansion,
    demonsDowntown,
    cosmicDowntown,
    busyCityDisturbed,
    savageLandResearchSite,
    sunkShipShelteringSinisterSecrets,
    sinisterShowdown,
    oscropChemical,
    aHulkCornered,
    dockyardDestructionSpiderManToBlame,
    nightTimePatrol,
    sandScrap,
    swingIntoAction,
  ].map((map) => [map.id, map]),
)
