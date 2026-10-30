import { CONFIG } from '../../config'
import { HUMAN } from './HumanBody'
import { BUST } from './HumanHead'
import { ROBOT } from './RobotHead'

/** The active character — switch in src/config.js. */
export const CHARACTER = { human: HUMAN, bust: BUST, robot: ROBOT }[CONFIG.character] ?? HUMAN
