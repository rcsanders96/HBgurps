'use strict'

import * as Settings from '../lib/miscellaneous-settings.js'

/*
  Defines the range strategy used throughout the application. A range strategy
  is defined as an ordered (closest range to farthest range) array of range 
  bands. A range band is defined as a structure like this:

  {
    moddesc: <String: text to use in the modifier bucket>,
    max: <num: number of yards that define the maximum distance of this band>,				
    penalty: <num: modifier to use for ranged attacks in this band>,
    desc: <String: text that describes the range>
  }

  Responsibilities:

  - Defines a world setting to set the range strategy. Currently supported: 
    * Standand (Size and Speed/Range Table from Basic).
    * Simplifed (Range bands from Monster Hunters 2: The Enemy).
   
  - On update of the setting, update the modifier bucket and all actors.

  - On start up (a 'ready' hook) set the range bands and modifiers based 
    on the current setting value.
    
  - Maintains an instance variable (ranges) that contains the current set of 
    range bands based on the chosen strategy. 

  - Maintains an instance variable (modifiers) that contains an array of 
    modifier text for the modifier bucket.
 */
export default class GURPSRange {
  constructor() {
    this.setup()
    this.ranges = basicSetRanges
    this._buildModifiers()
  }

  setup() {
    let self = this

    // Set the range to whatever the setting is upon opening the world.
    // Have to do it this way because the order of "init Hooks" is indeterminate.
    // This will run after all init hooks have been processed.
    Hooks.once('ready', async function () {
      self.update()

      // Replace the range ruler with our own.
      Ruler.prototype._getSegmentLabel = (segmentDistance, totalDistance, isTotal) => {
        const units = canvas.scene.data.gridUnits
        let dist = (d, u) => {
          return `${Math.round(d * 100) / 100} ${u}`
        }

        let label = dist(segmentDistance, units)
        let mod = self.yardsToSpeedRangePenalty(totalDistance)
        game.GURPS.ModifierBucket.setTempRangeMod(mod)
        if (isTotal && segmentDistance !== totalDistance) {
          label += ` [${dist(totalDistance, units)}]`
        }
        return label + ` (${mod})`
      }

      Ruler.prototype._endMeasurementOrig = Ruler.prototype._endMeasurement
      Ruler.prototype._endMeasurement = function () {
        let addRangeMod = !this.draggedEntity // Will be false is using DragRuler and it was movement
        this._endMeasurementOrig()
        if (addRangeMod) GURPS.ModifierBucket.addTempRangeMod()
      }
    })
  }

  yardsToSpeedRangePenalty(yards) {
    for (let range of this.ranges) {
      if (typeof range.max === 'string')
        // Handles last distance being "500+"
        return range.penalty
      if (yards <= range.max) return range.penalty
    }
  }

  _buildModifiers() {
    let m = []
    this.ranges.forEach(band => {
      if (band.penalty != 0) {
        GURPS.addModifier(band.penalty, band.moddesc, m)
      }
    })
    this.modifiers = m.map(e => e.mod + ' ' + e.desc)
  }

  async update() {
    let currentValue = game.settings.get(Settings.SYSTEM_NAME, Settings.SETTING_RANGE_STRATEGY)
    console.log(currentValue)

    if (currentValue === 'Standard') {
      this.ranges = basicSetRanges
    } else {
      this.ranges = monsterHunter2Ranges
    }
    this._buildModifiers()

    // update modifier bucket
    if (!!GURPS.ModifierBucket) GURPS.ModifierBucket.refresh()

    // FYI update all actors
    for (const actor of game.actors.contents) {
      if (actor.permission >= CONST.ENTITY_PERMISSIONS.OBSERVER)
        // Return true if the current game user has observer or owner rights to an actor
        await actor.update({ ranges: this.ranges })
    }
  }
}

// Must be kept in order... checking range vs Max.   If >Max, go to next entry.
/* Example code:
        for (let range of game.GURPS.ranges) {
          if (yards <= range.max)
            return range.penalty
        }
*/
const monsterHunter2Ranges = [
  {
    moddesc: 'Close range (5 yds)',
    max: 5,
    penalty: 0,
    description: 'Can touch or strike foe',
  },
  {
    moddesc: 'Short range (20 yds)',
    max: 20,
    penalty: -3,
    description: 'Can talk to foe; pistol or muscle-powered missile range',
  },
  {
    moddesc: 'Medium range (100 yds)',
    max: 100,
    penalty: -7,
    description: 'Can only shout to foe; shotgun or SMG range',
  },
  {
    moddesc: 'Long range (500 yds)',
    max: 500,
    penalty: -11,
    description: 'Opponent out of earshot; rifle range',
  },
  {
    moddesc: 'Extreme range (500+ yds)',
    max: '500+', // Finaly entry.   We will check for "is string" to assume infinite
    penalty: -15,
    desc: 'Rival difficult to even see; sniper range',
  },
]

// Must be kept in order... checking range vs Max.   If >Max, go to next entry.
const basicSetRanges = []

VisionIncrement = 10
count = 1

while (count < 100) {
  let d = {
    moddesc: `for ${count} increments`,
    max: VisionIncrement*count,
    penalty: count-1,
    desc: `${count} increments`,
  }
  basicSetRanges.push(d)
}
