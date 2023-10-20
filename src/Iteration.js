import { spawn } from 'node:child_process';

import { updateState } from '../db/state.js';
import CheckBattery from './CheckBattery.js';
import {
  PUT_ON_MSG,
  TAKE_OFF_MSG,
  SHORT_DELAY,
  LONG_DELAY,
} from './constants.js';
import { getChargingAndLevel, sayAlert } from './utils.js';

// This class handles spawning
// child processes and alerting.

export default class Iteration {
  constructor(iteration) {
    this.iteration = iteration;
    this.delay = iteration >= 5 ? LONG_DELAY : SHORT_DELAY;
    this.shouldAlert = false;
    this.alertMessage = null;
  }

  // Spawn pmset to retrieve
  // charging / battery information.
  spawnPmset() {
    return new Promise((resolve, reject) => {
      const pmset = spawn('pmset', ['-g', 'batt']);

      pmset.stdout.on('data', (data) => {
        resolve(getChargingAndLevel(data));
      });

      pmset.stderr.on('data', (err) => {
        reject(`Error running Pmset\n${err}`);
      });

      pmset.on('close', (code) => {
        if (code !== 0) {
          CheckBattery.log({
            isFirst: false,
            message: `Pmset exited with error code:\n${code}`,
          });
        }
      });
    });
  }

  // Determine if we should alert.
  // Set some data if so.
  checkIfShouldAlert({ charging, chargeLevel }) {
    const takeOff = charging && chargeLevel >= 80;
    const putOn = !charging && chargeLevel <= 20;

    CheckBattery.log({
      isFirst: false,
      message: `takeOff: ${takeOff}, putOn: ${putOn}`,
    });

    if (takeOff || putOn) {
      this.shouldAlert = true;
    }

    if (takeOff) {
      this.alertMessage = TAKE_OFF_MSG;
    }

    if (putOn) {
      this.alertMessage = PUT_ON_MSG;
    }
  }

  // Update DB state if currently inactive.
  // Spawn message to say alert.
  async alert({ alertType }) {
    CheckBattery.log({
      isFirst: false,
      message: `*Alert condition met: ${alertType}*`,
    });

    const isActive = (await getState()) === 'active';

    if (!isActive) {
      CheckBattery.log({ isFirst: false, message: 'Entering active state.' });

      await updateState('active');
    }

    sayAlert(this.alertMessage);
  }
}