/**
 * Parlay validation module.
 * Validates parlay creation payloads with field-level error reporting.
 */

// Types reference: validates payloads conforming to SaveParlayPayload from @/lib/types/parlay

// --- Validation Result Types ---

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

// --- Constants ---

const MIN_LEGS = 2
const MAX_LEGS = 10
const MIN_PROP_LINE = 0.5
const MAX_PROP_LINE = 999.5
const MIN_ODDS = -10000
const MAX_ODDS = 10000
const MIN_STAKE = 0.01
const MAX_STAKE = 99999.99
const MAX_CUSTOM_NOTE_LENGTH = 280
const MAX_PLAYER_NAME_LENGTH = 100
const MAX_STAT_CATEGORY_LENGTH = 50
const MAX_SPORT_LENGTH = 50
const VALID_DIRECTIONS: readonly string[] = ["over", "under"]
const VALID_VISIBILITIES: readonly string[] = ["public", "private"]

// --- Validation Functions ---

/**
 * Validates a parlay creation request body.
 * Returns structured validation errors with field-level details.
 */
export function validateCreateParlay(body: unknown): ValidationResult {
  const errors: ValidationError[] = []

  if (body === null || body === undefined || typeof body !== "object") {
    return { valid: false, errors: [{ field: "body", message: "Request body must be a JSON object." }] }
  }

  const payload = body as Record<string, unknown>

  // --- Validate legs array ---
  if (!Array.isArray(payload.legs)) {
    errors.push({ field: "legs", message: "legs must be an array." })
  } else {
    if (payload.legs.length < MIN_LEGS) {
      errors.push({ field: "legs", message: `legs must contain at least ${MIN_LEGS} items.` })
    } else if (payload.legs.length > MAX_LEGS) {
      errors.push({ field: "legs", message: `legs must contain at most ${MAX_LEGS} items.` })
    }

    // Validate each leg
    for (let i = 0; i < payload.legs.length; i++) {
      const legErrors = validateLeg(payload.legs[i], i)
      errors.push(...legErrors)
    }
  }

  // --- Validate visibility ---
  if (payload.visibility === undefined || payload.visibility === null) {
    errors.push({ field: "visibility", message: "visibility is required." })
  } else if (typeof payload.visibility !== "string" || !VALID_VISIBILITIES.includes(payload.visibility)) {
    errors.push({ field: "visibility", message: 'visibility must be "public" or "private".' })
  }

  // --- Validate odds (optional) ---
  if (payload.odds !== undefined && payload.odds !== null) {
    if (typeof payload.odds !== "number" || isNaN(payload.odds)) {
      errors.push({ field: "odds", message: "odds must be a number." })
    } else if (payload.odds < MIN_ODDS || payload.odds > MAX_ODDS) {
      errors.push({ field: "odds", message: `odds must be between ${MIN_ODDS} and ${MAX_ODDS}.` })
    }
  }

  // --- Validate stake (optional) ---
  if (payload.stake !== undefined && payload.stake !== null) {
    if (typeof payload.stake !== "number" || isNaN(payload.stake)) {
      errors.push({ field: "stake", message: "stake must be a number." })
    } else if (payload.stake < MIN_STAKE || payload.stake > MAX_STAKE) {
      errors.push({ field: "stake", message: `stake must be between ${MIN_STAKE} and ${MAX_STAKE}.` })
    }
  }

  // --- Validate custom_note (optional) ---
  if (payload.custom_note !== undefined && payload.custom_note !== null) {
    if (typeof payload.custom_note !== "string") {
      errors.push({ field: "custom_note", message: "custom_note must be a string." })
    } else if (payload.custom_note.length > MAX_CUSTOM_NOTE_LENGTH) {
      errors.push({ field: "custom_note", message: `custom_note must be at most ${MAX_CUSTOM_NOTE_LENGTH} characters.` })
    }
  }

  // --- Validate combined_hit_rate (optional) ---
  if (payload.combined_hit_rate !== undefined && payload.combined_hit_rate !== null) {
    if (typeof payload.combined_hit_rate !== "number" || isNaN(payload.combined_hit_rate)) {
      errors.push({ field: "combined_hit_rate", message: "combined_hit_rate must be a number." })
    } else if (payload.combined_hit_rate < 0 || payload.combined_hit_rate > 100) {
      errors.push({ field: "combined_hit_rate", message: "combined_hit_rate must be between 0 and 100." })
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validates a single parlay leg object.
 * Returns an array of validation errors for the leg at the given index.
 */
function validateLeg(leg: unknown, index: number): ValidationError[] {
  const errors: ValidationError[] = []
  const prefix = `legs[${index}]`

  if (leg === null || leg === undefined || typeof leg !== "object") {
    errors.push({ field: prefix, message: "Each leg must be an object." })
    return errors
  }

  const legObj = leg as Record<string, unknown>

  // player_name: required string, max 100
  if (legObj.player_name === undefined || legObj.player_name === null) {
    errors.push({ field: `${prefix}.player_name`, message: "player_name is required." })
  } else if (typeof legObj.player_name !== "string") {
    errors.push({ field: `${prefix}.player_name`, message: "player_name must be a string." })
  } else if (legObj.player_name.length === 0) {
    errors.push({ field: `${prefix}.player_name`, message: "player_name must not be empty." })
  } else if (legObj.player_name.length > MAX_PLAYER_NAME_LENGTH) {
    errors.push({ field: `${prefix}.player_name`, message: `player_name must be at most ${MAX_PLAYER_NAME_LENGTH} characters.` })
  }

  // stat_category: required string, max 50
  if (legObj.stat_category === undefined || legObj.stat_category === null) {
    errors.push({ field: `${prefix}.stat_category`, message: "stat_category is required." })
  } else if (typeof legObj.stat_category !== "string") {
    errors.push({ field: `${prefix}.stat_category`, message: "stat_category must be a string." })
  } else if (legObj.stat_category.length === 0) {
    errors.push({ field: `${prefix}.stat_category`, message: "stat_category must not be empty." })
  } else if (legObj.stat_category.length > MAX_STAT_CATEGORY_LENGTH) {
    errors.push({ field: `${prefix}.stat_category`, message: `stat_category must be at most ${MAX_STAT_CATEGORY_LENGTH} characters.` })
  }

  // prop_line: required number, 0.5 to 999.5
  if (legObj.prop_line === undefined || legObj.prop_line === null) {
    errors.push({ field: `${prefix}.prop_line`, message: "prop_line is required." })
  } else if (typeof legObj.prop_line !== "number" || isNaN(legObj.prop_line)) {
    errors.push({ field: `${prefix}.prop_line`, message: "prop_line must be a number." })
  } else if (legObj.prop_line < MIN_PROP_LINE || legObj.prop_line > MAX_PROP_LINE) {
    errors.push({ field: `${prefix}.prop_line`, message: `prop_line must be between ${MIN_PROP_LINE} and ${MAX_PROP_LINE}.` })
  }

  // direction: required, must be "over" or "under"
  if (legObj.direction === undefined || legObj.direction === null) {
    errors.push({ field: `${prefix}.direction`, message: "direction is required." })
  } else if (typeof legObj.direction !== "string" || !VALID_DIRECTIONS.includes(legObj.direction)) {
    errors.push({ field: `${prefix}.direction`, message: 'direction must be "over" or "under".' })
  }

  // l10_hit_rate: required number, 0 to 100
  if (legObj.l10_hit_rate === undefined || legObj.l10_hit_rate === null) {
    errors.push({ field: `${prefix}.l10_hit_rate`, message: "l10_hit_rate is required." })
  } else if (typeof legObj.l10_hit_rate !== "number" || isNaN(legObj.l10_hit_rate)) {
    errors.push({ field: `${prefix}.l10_hit_rate`, message: "l10_hit_rate must be a number." })
  } else if (legObj.l10_hit_rate < 0 || legObj.l10_hit_rate > 100) {
    errors.push({ field: `${prefix}.l10_hit_rate`, message: "l10_hit_rate must be between 0 and 100." })
  }

  // sport: required string, max 50
  if (legObj.sport === undefined || legObj.sport === null) {
    errors.push({ field: `${prefix}.sport`, message: "sport is required." })
  } else if (typeof legObj.sport !== "string") {
    errors.push({ field: `${prefix}.sport`, message: "sport must be a string." })
  } else if (legObj.sport.length === 0) {
    errors.push({ field: `${prefix}.sport`, message: "sport must not be empty." })
  } else if (legObj.sport.length > MAX_SPORT_LENGTH) {
    errors.push({ field: `${prefix}.sport`, message: `sport must be at most ${MAX_SPORT_LENGTH} characters.` })
  }

  return errors
}
