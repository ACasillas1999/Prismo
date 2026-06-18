'use strict';

/**
 * Motor de cálculo de puntajes para evaluaciones.
 *
 * Fórmula:
 *   Para cada criterio:
 *     Si tipo = "measurable":
 *       criterion_pct = min(agent_value / target_value × 100, 100)
 *       Si evaluator_score existe → usa evaluator_score (override)
 *     Si tipo = "subjective":
 *       criterion_pct = evaluator_score (0-100)
 *
 *   Para cada categoría:
 *     category_score = Σ(criterion_pct × criterion.weight / 100)
 *
 *   Puntaje final:
 *     overall_score = Σ(category_score × category.weight / 100)
 */

/**
 * Calculate a single criterion's score (can be > 100 if cap_at_100 is false).
 */
function calculateCriterionScore(criterion, score) {
  const cap = criterion.cap_at_100 !== false; // defaults to true

  if (criterion.type === 'measurable') {
    // If evaluator overrides, use that
    if (score.evaluator_score !== null && score.evaluator_score !== undefined) {
      const eScore = parseFloat(score.evaluator_score);
      return cap ? Math.min(eScore, 100) : eScore;
    }

    // Calculate from agent value vs target or rules
    if (score.agent_value !== null && score.agent_value !== undefined && score.agent_value !== '') {
      const val = parseFloat(score.agent_value);

      // 1. Check advanced rules
      let rules = criterion.rules;
      if (typeof rules === 'string') {
        try { rules = JSON.parse(rules); } catch (e) { rules = []; }
      }
      if (rules && Array.isArray(rules) && rules.length > 0) {
        for (const rule of rules) {
          const min = parseFloat(rule.min);
          const max = parseFloat(rule.max);
          if (val >= min && val <= max) {
            return parseFloat(rule.pct); // Rule match provides exact %
          }
        }
      }

      // 2. Default proportional calculation (only if target_value is present)
      if (criterion.target_value !== null && criterion.target_value !== undefined) {
        const target = parseFloat(criterion.target_value);
        if (target === 0) {
          return val === 0 ? 100 : 0;
        }
        const pct = (val / target) * 100;
        return cap ? Math.min(pct, 100) : pct;
      }
    }
    return 0;
  }

  // Subjective: use evaluator's score directly
  if (score.evaluator_score !== null && score.evaluator_score !== undefined) {
    const eScore = parseFloat(score.evaluator_score);
    return cap ? Math.min(eScore, 100) : eScore;
  }

  return 0;
}

/**
 * Calculate a category's weighted score (0-100).
 * @param {Object} category - { weight, criteria: [...] }
 * @param {Object} scoresMap - { criterion_id: score_record }
 */
function calculateCategoryScore(category, scoresMap) {
  let totalScore = 0;

  for (const criterion of category.criteria) {
    const scoreRecord = scoresMap[criterion.id];
    if (!scoreRecord) continue;

    const criterionPct = calculateCriterionScore(criterion, scoreRecord);
    const weightedContribution = criterionPct * (parseFloat(criterion.weight) / 100);
    totalScore += weightedContribution;
  }

  return totalScore;
}

/**
 * Calculate the overall evaluation score (0-100).
 * @param {Array} categories - [{ weight, criteria: [...] }]
 * @param {Object} scoresMap - { criterion_id: score_record }
 */
function calculateOverallScore(categories, scoresMap) {
  let overallScore = 0;

  for (const category of categories) {
    const categoryScore = calculateCategoryScore(category, scoresMap);
    const weightedContribution = categoryScore * (parseFloat(category.weight) / 100);
    overallScore += weightedContribution;
  }

  return Math.round(overallScore * 100) / 100; // Round to 2 decimals
}

/**
 * Calculate detailed scores for an evaluation.
 * Returns { overall, categories: [{ score, criteria: [{ score }] }] }
 */
function calculateDetailedScores(categories, scoresMap) {
  const result = {
    overall: 0,
    categories: [],
  };

  for (const category of categories) {
    const catResult = {
      id: category.id,
      name: category.name,
      weight: parseFloat(category.weight),
      score: 0,
      weighted_contribution: 0,
      criteria: [],
    };

    for (const criterion of category.criteria) {
      const scoreRecord = scoresMap[criterion.id];
      const criterionScore = scoreRecord ? calculateCriterionScore(criterion, scoreRecord) : 0;

      catResult.criteria.push({
        id: criterion.id,
        name: criterion.name,
        type: criterion.type,
        weight: parseFloat(criterion.weight),
        score: Math.round(criterionScore * 100) / 100,
        weighted_contribution: Math.round(criterionScore * parseFloat(criterion.weight) / 100 * 100) / 100,
        agent_value: scoreRecord?.agent_value ?? null,
        target_value: criterion.target_value ? parseFloat(criterion.target_value) : null,
        evaluator_score: scoreRecord?.evaluator_score ?? null,
      });

      catResult.score += criterionScore * (parseFloat(criterion.weight) / 100);
    }

    catResult.score = Math.round(catResult.score * 100) / 100;
    catResult.weighted_contribution = Math.round(catResult.score * catResult.weight / 100 * 100) / 100;
    result.overall += catResult.score * (catResult.weight / 100);
    result.categories.push(catResult);
  }

  result.overall = Math.round(result.overall * 100) / 100;

  return result;
}

module.exports = { calculateCriterionScore, calculateCategoryScore, calculateOverallScore, calculateDetailedScores };
