// src/utils/stats.js
// Ported from odetomisery. Logic untouched except:
// - ES module syntax (export default instead of module.exports)
// - Constructor accepts pre-built itemStats and fullItemData directly
//   instead of resolving from item name strings + itemData lookup.
//   This lets us merge bonus slots before passing in.

//again thank you claude for doing all the scraping and ruining the beautiful code my friends made
//so that i could fit it all in the square hole

import Percentage from './percentage'

const SLOT_TYPES = ['mainhand', 'offhand', 'helmet', 'chestplate', 'leggings', 'boots']

export default class Stats {
  constructor(itemStats, fullItemData, formData, enabledBoxes, extraStats, enabledClassAbilityBuffs) {
    this.region = Number(formData.region || 2)
    this.enabledBoxes = enabledBoxes
    this.enabledClassAbilityBuffs = enabledClassAbilityBuffs

    // Accept pre-built itemStats and fullItemData directly
    this.fullItemData = fullItemData
    this.itemStats = itemStats

    this.situationals = {
      shielding: { enabled: enabledBoxes.shielding, level: 0 },
      poise: { enabled: enabledBoxes.poise, level: 0 },
      inure: { enabled: enabledBoxes.inure, level: 0 },
      steadfast: { enabled: enabledBoxes.steadfast, level: 0 },
      guard: { enabled: enabledBoxes.guard, level: 0 },
      second_wind: { enabled: enabledBoxes.second_wind, level: 0 },
      ethereal: { enabled: enabledBoxes.ethereal, level: 0 },
      reflexes: { enabled: enabledBoxes.reflexes, level: 0 },
      evasion: { enabled: enabledBoxes.evasion, level: 0 },
      tempo: { enabled: enabledBoxes.tempo, level: 0 },
      cloaked: { enabled: enabledBoxes.cloaked, level: 0 },
      earth_aspect: { enabled: enabledBoxes.earth_aspect, level: 0 },

      smite: { enabled: enabledBoxes.smite, level: 0 },
      duelist: { enabled: enabledBoxes.duelist, level: 0 },
      slayer: { enabled: enabledBoxes.slayer, level: 0 },
      point_blank: { enabled: enabledBoxes.point_blank, level: 0 },
      sniper: { enabled: enabledBoxes.sniper, level: 0 },
      first_strike: { enabled: enabledBoxes.first_strike, level: 0 },
      regicide: { enabled: enabledBoxes.regicide, level: 0 },
      trivium: { enabled: enabledBoxes.trivium, level: 0 },
      stamina: { enabled: enabledBoxes.stamina, level: 0 },
      technique: { enabled: enabledBoxes.technique, level: 0 },
      abyssal: { enabled: enabledBoxes.abyssal, level: 0 },
      fractal: { enabled: enabledBoxes.fractal, level: 0 },
      skyseeker: { enabled: enabledBoxes.skyseeker, level: 0 },

      retaliation_normal: { enabled: enabledBoxes.retaliation_normal, level: 0 },
      retaliation_elite: { enabled: enabledBoxes.retaliation_elite, level: 0 },
      retaliation_boss: { enabled: enabledBoxes.retaliation_boss, level: 0 },

      adaptability: { enabled: true, level: 0 },
    }

    this.tenacity = formData.tenacity ? formData.tenacity : 0
    this.vitality = formData.vitality ? formData.vitality : 0
    this.vigor = formData.vigor ? formData.vigor : 0
    this.focus = formData.focus ? formData.focus : 0
    this.perspicacity = formData.perspicacity ? formData.perspicacity : 0

    this.currentHealthPercent = formData.health ? new Percentage(formData.health) : new Percentage(100)
    this.situationalCap = [20, 30, 36][this.region - 1]
    this.situationalEHPScaling = [0.2, 0.25, 0.3][this.region - 1]
    this.damageInfusionsMultiplier = 0.75 + 0.25 * this.region

    this.extraDamageMultiplier = 1
    this.extraResistanceMultiplier = new Percentage(100)
    this.extraHealthMultiplier = 1
    this.extraAttackSpeedMultiplier = 1
    this.extraSpeedMultiplier = 1

    if (extraStats) {
      if (extraStats.damageMultipliers) {
        this.extraDamageMultiplier = extraStats.damageMultipliers
          .map(p => p.val).reduce((acc, val) => acc * val, 1)
      }
      if (extraStats.resistanceMultipliers) {
        extraStats.resistanceMultipliers.map(p => p.val)
          .forEach(val => this.extraResistanceMultiplier.preciseMul(2 - val, false))
      }
      if (extraStats.healthMultipliers) {
        this.extraHealthMultiplier = extraStats.healthMultipliers
          .map(p => p.val).reduce((acc, val) => acc * val, 1)
      }
      if (extraStats.attackSpeedMultipliers) {
        this.extraAttackSpeedMultiplier = extraStats.attackSpeedMultipliers
          .map(p => p.val).reduce((acc, val) => acc * val, 1)
      }
      if (extraStats.speedMultipliers) {
        this.extraSpeedMultiplier = extraStats.speedMultipliers
          .map(p => p.val).reduce((acc, val) => acc * val, 1)
      }
    }

    this.setDefaultValues()
    this.sumAllStats()
    this.adjustStats()
    this.calculateDefenseStats()
    this.calculateOffenseStats()

    this.healthFinal = Number(this.healthFinal.toFixed(2))
    this.currentHealth = Number(this.currentHealth.toFixed(2))
  }

  calculateOffenseStats() {
    let flatAttackDamage = 0

    let firstStrikeSit = this.situationals.first_strike.enabled ? 10 * this.situationals.first_strike.level : 0
    let regicideSit = this.situationals.regicide.enabled ? 10 * this.situationals.regicide.level : 0
    let triviumSit = this.situationals.trivium.enabled ? 10 * this.situationals.trivium.level : 0
    let staminaSit = this.situationals.stamina.enabled ? 10 * this.situationals.stamina.level : 0
    let techniqueSit = this.situationals.technique.enabled ? 10 * this.situationals.technique.level : 0
    let abyssalSit = this.situationals.abyssal.enabled ? 10 * this.situationals.abyssal.level : 0
    let fractalSit = this.situationals.fractal.enabled ? 10 * this.situationals.fractal.level : 0
    let skyseekerSit = this.situationals.skyseeker.enabled ? 10 * this.situationals.skyseeker.level : 0
    let retaliationSit =
      this.situationals.retaliation_boss.enabled ? 65
      : this.situationals.retaliation_elite.enabled ? 50
      : this.situationals.retaliation_normal.enabled ? 35
      : 0

    if (this.enabledClassAbilityBuffs.celestial_blessing) {
      let bonus = this.enabledClassAbilityBuffs.celestial_blessing_lv2 ? 30 : 20
      this.classAttackDamagePercent.add(bonus)
      this.classProjectileDamagePercent.add(bonus)
      this.classMagicDamagePercent.add(bonus)
    }

    // Melee
    let attackDamageBase = this.sumNumberStat(this.itemStats.mainhand, 'attack_damage_base', this.attackDamage)
    ;['smite', 'duelist', 'slayer'].forEach(specialist => {
      if (this.enabledBoxes[specialist])
        attackDamageBase += this.sumEnchantmentStat(this.itemStats.mainhand, specialist, 2)
    })

    this.attackDamagePercent.add(this.damageInfusionsMultiplier * Number(this.vigor))
    this.attackDamagePercent.add(firstStrikeSit)
    this.attackDamagePercent.add(regicideSit)
    this.attackDamagePercent.add(staminaSit)
    this.attackDamagePercent.add(abyssalSit)
    this.attackDamagePercent.add(skyseekerSit)
    this.attackDamagePercent.add(retaliationSit)

    if (this.enabledClassAbilityBuffs.weapon_mastery) {
      if (this.fullItemData.mainhand.type === 'Axe') {
        this.classAttackDamagePercent.add(this.enabledClassAbilityBuffs.weapon_mastery_lv2 ? 10 : 5)
        if (this.enabledClassAbilityBuffs.weapon_mastery_enhancement)
          this.classAttackDamagePercent.add(10)
      } else if (this.fullItemData.mainhand.base_item?.match(/Sword/i)) {
        this.classAttackDamagePercent.add(this.enabledClassAbilityBuffs.weapon_mastery_lv2 ? 10 : 0)
        if (this.enabledClassAbilityBuffs.weapon_mastery_enhancement)
          this.classAttackDamagePercent.add(10)
      }
    }
    if (this.enabledClassAbilityBuffs.versatile) {
      this.classAttackDamagePercent.add((this.projectileDamagePercent.perc - 100) * 0.5)
    }
    if (
      (this.enabledClassAbilityBuffs.dethroner_boss || this.enabledClassAbilityBuffs.dethroner_elite) &&
      this.fullItemData.mainhand.base_item?.match(/Sword/i) &&
      this.fullItemData.offhand.type === 'Offhand Sword'
    ) {
      this.classAttackDamagePercent.add(this.enabledClassAbilityBuffs.dethroner_boss ? 15 : 30)
    }
    if (this.enabledClassAbilityBuffs.channeling) {
      this.classAttackDamagePercent.add(20)
    }

    if (this.enabledClassAbilityBuffs.weapon_mastery) {
      if (this.fullItemData.mainhand.type === 'Axe') {
        flatAttackDamage += this.enabledClassAbilityBuffs.weapon_mastery_lv2 ? 4 : 2
      } else if (this.fullItemData.mainhand.type === 'Mainhand Sword') {
        flatAttackDamage += this.enabledClassAbilityBuffs.weapon_mastery_lv2 ? 1 : 0
      }
    }

    let attackDamage = attackDamageBase
      * this.attackDamagePercent.val
      * ((this.currentHealthPercent.perc <= 50) ? 1 - 0.1 * this.crippling : 1)
      * this.classAttackDamagePercent.val
      * this.extraDamageMultiplier
    let attackDamageCrit = this.cumbersome ? attackDamage : attackDamage * 1.5
    attackDamage += flatAttackDamage
    attackDamageCrit += flatAttackDamage

    let attackSpeed = (this.sumNumberStat(this.itemStats.mainhand, 'attack_speed_base', this.attackSpeed) + this.attackSpeedFlatBonus)
      * this.attackSpeedPercent.val
      * this.extraAttackSpeedMultiplier
    let attackCritSpeed = Math.min(attackSpeed, 5 / 3)

    // Projectile
    let projectileDamageBase = this.sumNumberStat(this.itemStats.mainhand, 'projectile_damage_base', this.projectileDamage)
    ;['point_blank', 'sniper'].forEach(specialist => {
      if (this.enabledBoxes[specialist])
        projectileDamageBase += this.sumEnchantmentStat(this.itemStats.mainhand, specialist, 2)
    })

    this.projectileDamagePercent.add(this.damageInfusionsMultiplier * Number(this.focus))
    this.projectileDamagePercent.add(firstStrikeSit)
    this.projectileDamagePercent.add(regicideSit)
    this.projectileDamagePercent.add(staminaSit)
    this.projectileDamagePercent.add(0.75 * techniqueSit)
    this.projectileDamagePercent.add(abyssalSit)
    this.projectileDamagePercent.add(skyseekerSit)
    this.projectileDamagePercent.add(retaliationSit * 0.5)

    if (this.enabledClassAbilityBuffs.versatile) {
      this.classProjectileDamagePercent.add((this.attackDamagePercent.perc - 100) * 0.4)
    }

    let projectileSpeed = this.sumNumberStat(this.itemStats.mainhand, 'projectile_speed_base', this.projectileSpeed) * this.projectileSpeedPercent.val
    let throwRate = this.sumNumberStat(this.itemStats.mainhand, 'throw_rate_base', this.throwRate) * this.throwRatePercent.val

    let projectileDamage = projectileDamageBase
      * this.projectileDamagePercent.val
      * this.classProjectileDamagePercent.val
      * this.extraDamageMultiplier

    // Magic
    this.spellPowerPercent.add(this.sumNumberStat(this.itemStats.mainhand, 'spell_power_base', 0))
    let potionDamageBase = this.sumNumberStat(this.itemStats.mainhand, 'potion_damage_flat', 0)

    this.magicDamagePercent.add(this.damageInfusionsMultiplier * Number(this.perspicacity))
    this.magicDamagePercent.add(regicideSit)
    this.magicDamagePercent.add(triviumSit)
    this.magicDamagePercent.add(techniqueSit)
    this.magicDamagePercent.add(abyssalSit)
    this.magicDamagePercent.add(fractalSit)
    this.magicDamagePercent.add(skyseekerSit)
    this.magicDamagePercent.add(retaliationSit * 0.5)
    if (this.fullItemData.mainhand?.stats?.alchemical_utensil) {
      this.magicDamagePercent.add(firstStrikeSit)
    }

    if (this.enabledClassAbilityBuffs.taboo_lv2) {
      this.classMagicDamagePercent.add(this.enabledClassAbilityBuffs.taboo_burst ? 80 : 30)
    } else if (this.enabledClassAbilityBuffs.taboo_lv1) {
      this.classMagicDamagePercent.add(20)
    }

    this.spellCooldownPercent = this.spellCooldownPercent.mul(Math.pow(0.95, this.aptitude), false)
    this.spellCooldownPercent = this.spellCooldownPercent.mul(Math.pow(1.05, this.ineptitude), false)

    let magicMultiplier = this.magicDamagePercent.val * this.classMagicDamagePercent.val * this.extraDamageMultiplier
    this.spellDamage = this.spellPowerPercent.duplicate().mul(magicMultiplier, false)
    this.potionDamage = potionDamageBase * magicMultiplier

    // display
    this.attackSpeedPercent = this.attackSpeedPercent.toFixedPerc(2)
    this.attackSpeed = attackSpeed.toFixed(2)
    this.attackDamagePercent = this.attackDamagePercent.toFixedPerc(2)
    this.classAttackDamagePercent = this.classAttackDamagePercent.toFixedPerc(2)
    this.attackDamage = attackDamage.toFixed(2)
    this.attackDamageCrit = attackDamageCrit.toFixed(2)
    this.iframeDPS = ((attackSpeed >= 2) ? attackDamage * 2 : attackDamage * attackSpeed).toFixed(2)
    this.iframeCritDPS = ((attackSpeed >= 2) ? attackDamageCrit * 2 : attackDamageCrit * attackSpeed).toFixed(2)
    this.critSpamDPS = (attackCritSpeed * attackDamageCrit).toFixed(2)

    //carlo's awesome derived stats
    //proj dps as an equivalent to crit spam dps, kind of.. throwing in some constants to get it close to other numbers
    //magic dps because i need an equivalent for wands. and this one is funky. and it takes bags into account too kinda
    const isBow = ['Bow', 'Crossbow'].includes(this.fullItemData.mainhand?.type)
    const effectiveThrowRate = (isBow && parseFloat(throwRate) === 0) ? 1.0 : parseFloat(throwRate)
    this.projSpamDPS = (parseFloat(projectileDamage) * effectiveThrowRate * 2).toFixed(2)
    this.magicDPS = (
      this.spellDamage.val * 15 * (100 / this.spellCooldownPercent.perc)
      + (parseFloat(this.potionDamage) * parseFloat(throwRate) * 2)
      + (attackDamage * attackSpeed * 0.1)
    ).toFixed(2)

    this.projectileDamagePercent = this.projectileDamagePercent.toFixedPerc(2)
    this.classProjectileDamagePercent = this.classProjectileDamagePercent.toFixedPerc(2)
    this.projectileDamage = projectileDamage.toFixed(2)
    this.projectileSpeedPercent = this.projectileSpeedPercent.toFixedPerc(2)
    this.projectileSpeed = projectileSpeed.toFixed(2)
    this.throwRatePercent = this.throwRatePercent.toFixedPerc(2)
    this.throwRate = throwRate.toFixed(2)

    this.magicDamagePercent = this.magicDamagePercent.toFixedPerc(2)
    this.classMagicDamagePercent = this.classMagicDamagePercent.toFixedPerc(2)
    this.spellPowerPercent = this.spellPowerPercent.toFixedPerc(2)
    this.spellDamage = this.spellDamage.toFixedPerc(2)
    this.spellCooldownPercent = this.spellCooldownPercent.toFixedPerc(2)
    this.potionDamage = this.potionDamage.toFixed(2)
  }

  calculateDefenseStats() {
    let drs = this.calculateDamageReductions()
    let drType = this.situationals.second_wind.enabled ? 'secondwind' : 'base'

    this.meleeDR = drs.melee[drType].toFixedPerc(2)
    this.projectileDR = drs.projectile[drType].toFixedPerc(2)
    this.magicDR = drs.magic[drType].toFixedPerc(2)
    this.blastDR = drs.blast[drType].toFixedPerc(2)
    this.fireDR = drs.fire[drType].toFixedPerc(2)
    this.fallDR = drs.fall[drType].toFixedPerc(2)
    this.ailmentDR = drs.ailment[drType].toFixedPerc(2)

    if (this.situationals.second_wind.level === 0 || drType === 'base') {
      this.meleeEHP = (this.healthFinal * this.currentHealthPercent.val / (1 - drs.melee.base.val)).toFixed(2)
      this.projectileEHP = (this.healthFinal * this.currentHealthPercent.val / (1 - drs.projectile.base.val)).toFixed(2)
      this.magicEHP = (this.healthFinal * this.currentHealthPercent.val / (1 - drs.magic.base.val)).toFixed(2)
      this.blastEHP = (this.healthFinal * this.currentHealthPercent.val / (1 - drs.blast.base.val)).toFixed(2)
      this.fireEHP = (this.healthFinal * this.currentHealthPercent.val / (1 - drs.fire.base.val)).toFixed(2)
      this.fallEHP = (this.healthFinal * this.currentHealthPercent.val / (1 - drs.fall.base.val)).toFixed(2)
      this.ailmentEHP = (this.healthFinal * this.currentHealthPercent.val / (1 - drs.ailment.base.val)).toFixed(2)
    } else {
      let hpNoSecondWind = Math.max(0, this.currentHealth - this.healthFinal * 0.5)
      let hpSecondWind = Math.min(this.currentHealth, this.healthFinal * 0.5)
      this.meleeEHP = (hpNoSecondWind / (1 - drs.melee.base.val) + hpSecondWind / (1 - drs.melee.secondwind.val)).toFixed(2)
      this.projectileEHP = (hpNoSecondWind / (1 - drs.projectile.base.val) + hpSecondWind / (1 - drs.projectile.secondwind.val)).toFixed(2)
      this.magicEHP = (hpNoSecondWind / (1 - drs.magic.base.val) + hpSecondWind / (1 - drs.magic.secondwind.val)).toFixed(2)
      this.blastEHP = (hpNoSecondWind / (1 - drs.blast.base.val) + hpSecondWind / (1 - drs.blast.secondwind.val)).toFixed(2)
      this.fireEHP = (hpNoSecondWind / (1 - drs.fire.base.val) + hpSecondWind / (1 - drs.fire.secondwind.val)).toFixed(2)
      this.fallEHP = (hpNoSecondWind / (1 - drs.fall.base.val) + hpSecondWind / (1 - drs.fall.secondwind.val)).toFixed(2)
      this.ailmentEHP = (hpNoSecondWind / (1 - drs.ailment.base.val) + hpSecondWind / (1 - drs.ailment.secondwind.val)).toFixed(2)
    }

    this.meleeHNDR = new Percentage((1 - ((1 - drs.melee[drType].val) / (this.healthFinal / 20))), false).toFixedPerc(2)
    this.projectileHNDR = new Percentage((1 - ((1 - drs.projectile[drType].val) / (this.healthFinal / 20))), false).toFixedPerc(2)
    this.magicHNDR = new Percentage((1 - ((1 - drs.magic[drType].val) / (this.healthFinal / 20))), false).toFixedPerc(2)
    this.blastHNDR = new Percentage((1 - ((1 - drs.blast[drType].val) / (this.healthFinal / 20))), false).toFixedPerc(2)
    this.fireHNDR = new Percentage((1 - ((1 - drs.fire[drType].val) / (this.healthFinal / 20))), false).toFixedPerc(2)
    this.fallHNDR = new Percentage((1 - ((1 - drs.fall[drType].val) / (this.healthFinal / 20))), false).toFixedPerc(2)
    this.ailmentHNDR = new Percentage((1 - ((1 - drs.ailment[drType].val) / (this.healthFinal / 20))), false).toFixedPerc(2)
  }

  calculateDamageTaken(noArmor, prot, fragility, protmodifier, armor, agility, usesSituationals) {
    let damageTaken = {}
    let worldlyProtDR = 0.025 * (this.region + 1)
    let worldlyProtMultiplier = 1 - this.worldlyProtection * worldlyProtDR
    let bonusResistanceMultiplier = 1
    let situationalResistanceMultiplier = 1

    damageTaken.base = noArmor
      ? 100 * worldlyProtMultiplier * Math.pow(0.96, prot * protmodifier - fragility * protmodifier)
      : 100 * worldlyProtMultiplier * Math.pow(0.96,
          (prot * protmodifier - fragility * protmodifier) + armor + agility
          - 0.5 * armor * agility / (armor + agility))

    damageTaken.secondwind = noArmor
      ? 100 * worldlyProtMultiplier * Math.pow(0.96, prot * protmodifier - fragility * protmodifier)
      : 100 * worldlyProtMultiplier * Math.pow(0.96,
          (prot * protmodifier - fragility * protmodifier) + armor + agility
          - 0.5 * armor * agility / (armor + agility))
    damageTaken.secondwind *= Math.pow(0.9, this.situationals.second_wind.level)

    if (this.enabledClassAbilityBuffs.weapon_mastery && this.fullItemData.mainhand.base_item?.match(/Sword/i))
      bonusResistanceMultiplier *= 0.9
    if (this.enabledClassAbilityBuffs.culling && this.fullItemData.mainhand.type === 'Scythe')
      bonusResistanceMultiplier *= 0.9
    if (this.enabledClassAbilityBuffs.totemic_empowerment)
      bonusResistanceMultiplier *= 0.9
    if (this.situationals.earth_aspect.enabled)
      bonusResistanceMultiplier *= 1 - 0.05 * this.situationals.earth_aspect.level

    if (usesSituationals) {
      let armorScaling = Math.min(armor / this.situationalCap, 1)
      let agilityScaling = Math.min(agility / this.situationalCap, 1)
      if (this.situationals.adaptability.level > 0) {
        armorScaling = Math.max(armorScaling, agilityScaling)
        agilityScaling = Math.max(armorScaling, agilityScaling)
      }
      armorScaling *= this.situationalEHPScaling
      agilityScaling *= this.situationalEHPScaling

      let etherealSit = this.situationals.ethereal.enabled ? agilityScaling * this.situationals.ethereal.level : 0
      let tempoSit = this.situationals.tempo.enabled ? agilityScaling * this.situationals.tempo.level : 0
      let evasionSit = this.situationals.evasion.enabled ? agilityScaling * this.situationals.evasion.level : 0
      let reflexesSit = this.situationals.reflexes.enabled ? agilityScaling * this.situationals.reflexes.level : 0
      let cloakedSit = this.situationals.cloaked.enabled ? agilityScaling * this.situationals.cloaked.level : 0
      let shieldingSit = this.situationals.shielding.enabled ? armorScaling * this.situationals.shielding.level : 0
      let poiseSit = this.situationals.poise.enabled
        ? (this.currentHealthPercent.val >= 0.9 ? armorScaling * this.situationals.poise.level : 0) : 0
      let inureSit = this.situationals.inure.enabled ? armorScaling * this.situationals.inure.level : 0
      let guardSit = this.situationals.guard.enabled ? armorScaling * this.situationals.guard.level : 0

      let steadfastScaling = (1 - this.currentHealthPercent.val) / 0.6
      if (steadfastScaling > 1) steadfastScaling = 1
      else if (steadfastScaling < 0) steadfastScaling = 0
      let steadfastSit = this.situationals.steadfast.enabled
        ? steadfastScaling * armorScaling * this.situationals.steadfast.level : 0

      let sumArmorSits = shieldingSit + poiseSit + inureSit + guardSit + steadfastSit
      let sumAgiSits = etherealSit + tempoSit + evasionSit + reflexesSit + cloakedSit
      situationalResistanceMultiplier = 1 / (1 + sumArmorSits + sumAgiSits)
    }

    damageTaken.base = damageTaken.base
      * (1 - this.tenacity * 0.005)
      * this.extraResistanceMultiplier.val
      * bonusResistanceMultiplier
      * situationalResistanceMultiplier

    damageTaken.secondwind = damageTaken.secondwind
      * (1 - this.tenacity * 0.005)
      * this.extraResistanceMultiplier.val
      * bonusResistanceMultiplier
      * situationalResistanceMultiplier

    return damageTaken
  }

  calculateDamageReductions() {
    let armor = this.armor < 0 ? 0 : this.armor
    let agility = this.agility < 0 ? 0 : this.agility
    let hasNothing = armor === 0 && agility === 0

    let halfArmor = armor / 2
    let halfAgility = agility / 2

    let meleeDamage = this.calculateDamageTaken(hasNothing, this.meleeProt, this.meleeFragility, 2, armor, agility, true)
    let projectileDamage = this.calculateDamageTaken(hasNothing, this.projectileProt, this.projectileFragility, 2, armor, agility, true)
    let magicDamage = this.calculateDamageTaken(hasNothing, this.magicProt, this.magicFragility, 2, armor, agility, true)
    let blastDamage = this.calculateDamageTaken(hasNothing, this.blastProt, this.blastFragility, 2, armor, agility, true)
    let fireDamage = this.calculateDamageTaken(hasNothing, this.fireProt, this.fireFragility, 2, halfArmor, halfAgility, false)
    let fallDamage = this.calculateDamageTaken(hasNothing, this.fallProt, 0, 3, halfArmor, halfAgility, false)
    let ailmentDamage = this.calculateDamageTaken(true, 0, 0, 0, 0, 0, false)

    return {
      melee:      { base: new Percentage(100 - meleeDamage.base),      secondwind: new Percentage(100 - meleeDamage.secondwind) },
      projectile: { base: new Percentage(100 - projectileDamage.base), secondwind: new Percentage(100 - projectileDamage.secondwind) },
      magic:      { base: new Percentage(100 - magicDamage.base),      secondwind: new Percentage(100 - magicDamage.secondwind) },
      blast:      { base: new Percentage(100 - blastDamage.base),      secondwind: new Percentage(100 - blastDamage.secondwind) },
      fire:       { base: new Percentage(100 - fireDamage.base),       secondwind: new Percentage(100 - fireDamage.secondwind) },
      fall:       { base: new Percentage(100 - fallDamage.base),       secondwind: new Percentage(100 - fallDamage.secondwind) },
      ailment:    { base: new Percentage(100 - ailmentDamage.base),    secondwind: new Percentage(100 - ailmentDamage.secondwind) },
    }
  }

  sumNumberStat(itemStats, statName, defaultIncrement) {
    if (!itemStats) return 0
    return itemStats[statName] ? Number(itemStats[statName]) : (defaultIncrement ? defaultIncrement : 0)
  }

  sumEnchantmentStat(itemStats, enchName, perLevelMultiplier) {
    if (!itemStats) return 0
    return itemStats[enchName] ? Number(itemStats[enchName]) * perLevelMultiplier : 0
  }

  adjustStats() {
    this.healthFinal = this.healthFlat * this.healthPercent.val * (1 + 0.01 * Number(this.vitality)) * this.extraHealthMultiplier
    this.currentHealth = this.healthFinal * this.currentHealthPercent.val

    this.speedPercent = this.speedPercent
      .mul(this.speedFlat / 0.1, false)
      .mul(this.currentHealthPercent.perc <= 50 ? 1 - 0.1 * this.crippling : 1, false)
      .mul(this.enabledClassAbilityBuffs.totemic_empowerment ? 1.1 : 1, false)
      .mul(this.enabledClassAbilityBuffs.celestial_blessing ? 1.2 : 1, false)
      .mul(this.enabledClassAbilityBuffs.weapon_mastery_enhancement && this.fullItemData.mainhand.type === 'Axe' ? 1.15 : 1, false)
      .mul(this.extraSpeedMultiplier, false)
      .toFixedPerc(2)

    if (this.enabledClassAbilityBuffs.formidable) this.knockbackRes += 2
    if (this.enabledClassAbilityBuffs.taboo) this.knockbackRes += 5
    this.knockbackRes = this.knockbackRes > 10 ? 100 : this.knockbackRes * 10

    let effHealingNonRounded = new Percentage(20 / this.healthFinal * this.healingRate.val, false)
    if (this.enabledClassAbilityBuffs.taboo) effHealingNonRounded.mul(50)
    this.effHealingRate = effHealingNonRounded.toFixedPerc(2)

    let regenPerSecNonRounded = 1 / 3 * Math.sqrt(this.baseRegenLevel) * this.healingRate.val
    regenPerSecNonRounded -= 1 / 3 * this.baseVeilcurseLevel
    if (this.enabledClassAbilityBuffs.taboo_burst) regenPerSecNonRounded -= 0.07 * this.healthFinal
    this.regenPerSec = regenPerSecNonRounded.toFixed(2)
    this.regenPerSecPercent = new Percentage(regenPerSecNonRounded / this.healthFinal, false).toFixedPerc(2)

    let lifeDrainOnCritFixedNonRounded = Math.sqrt(this.lifeDrainOnCrit) * this.healingRate.val
    this.lifeDrainOnCrit = lifeDrainOnCritFixedNonRounded.toFixed(2)
    this.healingRate = this.healingRate.toFixedPerc(2)
    this.lifeDrainOnCritPercent = new Percentage(lifeDrainOnCritFixedNonRounded / this.healthFinal, false).toFixedPerc(2)

    this.thorns = (this.thorns * this.thornsPercent.val).toFixed(2)
  }

  sumAllStats() {
    Object.keys(this.itemStats).forEach(type => {
      let itemStats = this.itemStats[type]
      if (itemStats !== undefined) {
        this.healthPercent.add(this.sumNumberStat(itemStats, 'max_health_percent'))
        this.healthFlat += this.sumNumberStat(itemStats, 'max_health_flat')
        this.agility += this.sumNumberStat(itemStats, 'agility')
        this.armor += this.sumNumberStat(itemStats, 'armor')
        this.speedPercent.add(this.sumNumberStat(itemStats, 'speed_percent'))
        this.speedFlat += this.sumNumberStat(itemStats, 'speed_flat')
        this.knockbackRes += this.sumNumberStat(itemStats, 'knockback_resistance_flat')
        this.thorns += this.sumNumberStat(itemStats, 'thorns_flat')
        this.thornsPercent.add(this.sumNumberStat(itemStats, 'thorns_percent'))
        this.throwRatePercent.add(this.sumNumberStat(itemStats, 'throw_rate_percent'))
        this.fireTickDamage += this.sumNumberStat(itemStats, 'inferno')

        this.healingRate
          .add(this.sumEnchantmentStat(itemStats, 'curse_of_anemia', -10))
          .add(this.sumEnchantmentStat(itemStats, 'sustenance', 10))
        this.baseRegenLevel += this.sumEnchantmentStat(itemStats, 'regeneration', 1)
        this.baseVeilcurseLevel += this.sumEnchantmentStat(itemStats, 'curse_of_the_veil', 1)
        this.lifeDrainOnCrit += this.sumEnchantmentStat(itemStats, 'life_drain', 1)

        this.meleeProt += this.sumNumberStat(itemStats, 'melee_protection')
        this.projectileProt += this.sumNumberStat(itemStats, 'projectile_protection')
        this.magicProt += this.sumNumberStat(itemStats, 'magic_protection')
        this.blastProt += this.sumNumberStat(itemStats, 'blast_protection')
        this.fireProt += this.sumNumberStat(itemStats, 'fire_protection')
        this.fallProt += this.sumNumberStat(itemStats, 'feather_falling')

        this.meleeFragility += this.sumNumberStat(itemStats, 'melee_fragility')
        this.projectileFragility += this.sumNumberStat(itemStats, 'projectile_fragility')
        this.magicFragility += this.sumNumberStat(itemStats, 'magic_fragility')
        this.blastFragility += this.sumNumberStat(itemStats, 'blast_fragility')
        this.fireFragility += this.sumNumberStat(itemStats, 'fire_fragility')

        this.attackDamagePercent.add(this.sumNumberStat(itemStats, 'attack_damage_percent'))
        this.attackSpeedPercent.add(this.sumNumberStat(itemStats, 'attack_speed_percent'))
        this.attackSpeedFlatBonus += this.sumNumberStat(itemStats, 'attack_speed_flat')

        this.projectileDamagePercent.add(this.sumNumberStat(itemStats, 'projectile_damage_percent'))
        this.projectileSpeedPercent.add(this.sumNumberStat(itemStats, 'projectile_speed_percent'))

        this.magicDamagePercent.add(this.sumNumberStat(itemStats, 'magic_damage_percent'))

        this.aptitude += this.sumEnchantmentStat(itemStats, 'aptitude', 1)
        this.ineptitude += this.sumEnchantmentStat(itemStats, 'ineptitude', 1)

        this.worldlyProtection += this.sumNumberStat(itemStats, 'worldly_protection')

        Object.keys(this.situationals).forEach(situ => {
          this.situationals[situ].level += this.sumNumberStat(itemStats, situ)
        })
        this.retaliation += this.sumNumberStat(itemStats, 'retaliation')

        this.crippling += this.sumNumberStat(itemStats, 'curse_of_crippling')
        this.corruption += this.sumNumberStat(itemStats, 'curse_of_corruption')
        this.instability += this.sumNumberStat(itemStats, 'curse_of_instability')
      }
    })
  }

  setDefaultValues() {
    this.agility = 0
    this.armor = 0
    this.speedPercent = new Percentage(100)
    this.speedFlat = 0.1
    this.knockbackRes = 0
    this.thorns = 0
    this.fireTickDamage = 1
    this.thornsPercent = new Percentage(100)

    this.healthPercent = new Percentage(100)
    this.healthFlat = 20
    this.healthFinal = 20
    this.currentHealth = 20
    this.healingRate = new Percentage(100)
    this.effHealingRate = new Percentage(100).toFixedPerc(2)
    this.baseRegenLevel = 0
    this.baseVeilcurseLevel = 0
    this.regenPerSecPercent = new Percentage(0)
    this.lifeDrainOnCrit = 0
    this.lifeDrainOnCritPercent = new Percentage(0)

    this.meleeProt = 0
    this.projectileProt = 0
    this.magicProt = 0
    this.blastProt = 0
    this.fireProt = 0
    this.fallProt = 0
    this.ailmentProt = 0

    this.meleeFragility = 0
    this.projectileFragility = 0
    this.magicFragility = 0
    this.blastFragility = 0
    this.fireFragility = 0

    this.meleeHNDR = new Percentage(0).toFixedPerc(2)
    this.projectileHNDR = new Percentage(0).toFixedPerc(2)
    this.magicHNDR = new Percentage(0).toFixedPerc(2)
    this.blastHNDR = new Percentage(0).toFixedPerc(2)
    this.fireHNDR = new Percentage(0).toFixedPerc(2)
    this.fallHNDR = new Percentage(0).toFixedPerc(2)
    this.ailmentHNDR = new Percentage(0).toFixedPerc(2)

    this.meleeDR = new Percentage(0).toFixedPerc(2)
    this.projectileDR = new Percentage(0).toFixedPerc(2)
    this.magicDR = new Percentage(0).toFixedPerc(2)
    this.blastDR = new Percentage(0).toFixedPerc(2)
    this.fireDR = new Percentage(0).toFixedPerc(2)
    this.fallDR = new Percentage(0).toFixedPerc(2)
    this.ailmentDR = new Percentage(0).toFixedPerc(2)

    this.meleeEHP = 0
    this.projectileEHP = 0
    this.magicEHP = 0
    this.blastEHP = 0
    this.fireEHP = 0
    this.fallEHP = 0
    this.ailmentEHP = 0

    this.worldlyProtection = 0

    this.attackDamagePercent = new Percentage(100)
    this.attackSpeedPercent = new Percentage(100)
    this.attackSpeed = 4
    this.attackSpeedFlatBonus = 0
    this.attackDamage = 1
    this.attackDamageCrit = 1.5
    this.iframeDPS = 2
    this.iframeCritDPS = 3
    this.critSpamDPS = 2

    //carlo's funky values
    this.projSpamDPS = 0
    this.magicDPS = 0

    this.projectileDamagePercent = new Percentage(100)
    this.projectileDamage = 0
    this.projectileSpeedPercent = new Percentage(100)
    this.projectileSpeed = 0
    this.throwRatePercent = new Percentage(100)
    this.throwRate = 0

    this.magicDamagePercent = new Percentage(100)
    this.spellPowerPercent = new Percentage(100)
    this.spellDamage = new Percentage(100)
    this.spellCooldownPercent = new Percentage(100)
    this.potionDamage = 1

    this.classAttackDamagePercent = new Percentage(100)
    this.classProjectileDamagePercent = new Percentage(100)
    this.classMagicDamagePercent = new Percentage(100)

    this.aptitude = 0
    this.ineptitude = 0
    this.crippling = 0
    this.corruption = 0
    this.retaliation = 0
    this.instability = 0

    this.twoHanded = this.itemStats.mainhand?.two_handed === 1
    this.weightless = this.itemStats.offhand?.weightless === 1
    this.cumbersome = this.itemStats.mainhand?.cumbersome === 1
  }
}