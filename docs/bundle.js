(function(){function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s}return e})()({1:[function(require,module,exports){
const {localCrontabToUtcCrontabs} = require('local-crontab');
const Selectr = require('mobius1-selectr');
const {zones} = require('tzdata');


const updateCrontab = () => {
  try {
    const localCrontab = document.querySelector('#input').value;
    const timezone = document.querySelector('#timezone').value;
    const utcCrontabs = localCrontabToUtcCrontabs(localCrontab, timezone);
    document.querySelector('#output').innerHTML = utcCrontabs.join('<br>');
  } catch (error){
    document.querySelector('#output').innerHTML = `error: ${error}`;
  }
};

document.querySelector('#timezone').innerHTML = Object.keys(zones)
  .map(zone => `<option value="${zone}">${zone}</option>`)
  .join('');
document.querySelector('#timezone').value = "America/New_York";
const selector = new Selectr('#timezone', {width: 250});

document.querySelector('#input').onkeyup = updateCrontab;
document.querySelector('#timezone').onchange = updateCrontab;
selector.on('selectr.change', updateCrontab);

updateCrontab();

},{"local-crontab":11,"mobius1-selectr":12,"tzdata":19}],2:[function(require,module,exports){

},{}],3:[function(require,module,exports){
'use strict';

var Part = require('./part');
var Seeker = require('./seeker');
var units = require('./units');

/**
 * Creates an instance of Cron.
 * Cron objects each represent a cron schedule.
 *
 * @constructor
 * @param {object} options The options to use
 * @this {Cron}
 */
function Cron(options) {
  if (options) {
    this.options = options;
  } else {
    this.options = {};
  }
  this.parts = null;
}

/**
 * Parses a cron string.
 *
 * @this {Cron}
 * @param {string} str The string to parse.
 */
Cron.prototype.fromString = function(str) {
  if (typeof str !== 'string') {
    throw new Error('Invalid cron string');
  }
  var parts = str.replace(/\s+/g, ' ').trim().split(' ');
  if (parts.length === 5) {
    var options = this.options;
    this.parts = parts.map(function(str, idx) {
      var part = new Part(units[idx], options);
      part.fromString(str);
      return part;
    });
  } else {
    throw new Error('Invalid cron string format');
  }
  return this;
};

/**
 * Returns the cron schedule as a string.
 *
 * @this {Cron}
 * @return {string} The cron schedule as a string.
 */
Cron.prototype.toString = function() {
  if (this.parts === null) {
    throw new Error('No schedule found');
  }
  return this.parts.join(' ');
};

/**
 * Parses a 2-dimentional array of integers as a cron schedule.
 *
 * @this {Cron}
 * @param {array} cronArr The array to parse.
 */
Cron.prototype.fromArray = function(cronArr) {
  if (cronArr.length === 5) {
    this.parts = cronArr.map(function(partArr, idx) {
      var part = new Part(units[idx]);
      part.fromArray(partArr);
      return part;
    });
  } else {
    throw new Error('Invalid cron array');
  }
  return this;
};

/**
 * Returns the cron schedule as
 * a 2-dimentional array of integers.
 *
 * @this {Cron}
 * @return {array} The cron schedule as an array.
 */
Cron.prototype.toArray = function() {
  if (this.parts === null) {
    throw new Error('No schedule found');
  }
  return this.parts.map(function(part) {
    return part.toArray();
  });
};

/**
 * Returns the time the schedule would run next.
 *
 * @this {Cron}
 * @param {Date} now A Date object
 * @return {object} A schedule iterator.
 */
Cron.prototype.schedule = function(now) {
  return new Seeker(this, now);
};

module.exports = Cron;

},{"./part":4,"./seeker":5,"./units":6}],4:[function(require,module,exports){
'use strict';

var sprintf = require('sprintf-js');
if (typeof sprintf.sprintf === 'function') { // For node.js
  sprintf = sprintf.sprintf;
}
var util = require('./util');

/**
 * Creates an instance of Part.
 * Part objects represent a collection of positive integers.
 *
 * @constructor
 * @this {Part}
 * @param {object} unit The unit of measurement of time (see units.js).
 * @param {object} options The options to use
 */
function Part(unit, options) {
  if (options) {
    this.options = options;
  } else {
    this.options = {};
  }
  this.unit = unit;
}

/**
 * Throws an exception.
 * Appends the unit name to the message.
 *
 * @this {Part}
 * @param {string} format A format string to use for the message.
 * @param {array} param The parameter to interpolate into the format string.
 */
Part.prototype.throw = function(format, param) {
  throw new Error(
    sprintf(
      '%(error)s for %(unitName)s',
      {
        error: sprintf(format, param),
        unitName: this.unit.name
      }
    )
  );
};

/**
 * Validates a range of positive integers.
 *
 * @this {Part}
 * @param {array} arr An array of positive integers.
 */
Part.prototype.fromArray = function(arr) {
  var values = util.sort(
    util.dedup(
      this.fixSunday(
        arr.map(
          function(value) {
            var parsedValue = parseInt(value, 10);
            if (isNaN(parsedValue)) {
              this.throw('Invalid value "%s"', value);
            }
            return parsedValue;
          },
          this
        )
      )
    )
  );
  if (!values.length) {
    this.throw('Empty interval value');
  }
  var value = this.outOfRange(values);
  if (typeof value !== 'undefined') {
    this.throw('Value "%s" out of range', value);
  }
  this.values = values;
};

/**
 * Parses a string as a range of positive integers.
 *
 * @this {Part}
 * @param {string} str The string to be parsed as a range.
 */
Part.prototype.fromString = function(str) {
  var unit = this.unit;
  var stringParts = str.split('/');
  if (stringParts.length > 2) {
    this.throw('Invalid value "%s"', str);
  }
  var rangeString = this.replaceAlternatives(stringParts[0]);
  var parsedValues;
  if (rangeString === '*') {
    parsedValues = util.range(unit.min, unit.max);
  } else {
    parsedValues = util.sort(
      util.dedup(
        this.fixSunday(
          util.flatten(
            rangeString.split(',').map(
              function(range) {
                return this.parseRange(range, str);
              },
              this
            )
          )
        )
      )
    );
    var value = this.outOfRange(parsedValues);
    if (typeof value !== 'undefined') {
      this.throw('Value "%s" out of range', value);
    }
  }
  var step = this.parseStep(stringParts[1]);
  var intervalValues = this.applyInterval(parsedValues, step);
  if (!intervalValues.length) {
    this.throw('Empty interval value "%s"', str);
  }
  this.values = intervalValues;
};

/**
 * Replace all 7 with 0 as Sunday can
 * be represented by both.
 *
 * @this {Part}
 * @param {array} values The values to process.
 * @return {array} The resulting array.
 */
Part.prototype.fixSunday = function(values) {
  if (this.unit.name === 'weekday') {
    values = values.map(function(value) {
      if (value === 7) {
        return 0;
      }
      return value;
    });
  }
  return values;
};

/**
 * Parses a range string
 *
 * @this {Part}
 * @param {string} range The range string.
 * @param {string} context The operation context string.
 * @return {array} The resulting array.
 */
Part.prototype.parseRange = function(range, context) {
  var subparts = range.split('-');
  if (subparts.length === 1) {
    var value = parseInt(subparts[0], 10);
    if (isNaN(value)) {
      this.throw('Invalid value "%s"', context);
    }
    return [value];
  } else if (subparts.length === 2) {
    var minValue = parseInt(subparts[0], 10);
    var maxValue = parseInt(subparts[1], 10);
    if (maxValue <= minValue) {
      this.throw(
        'Max range is less than min range in "%s"',
        range
      );
    }
    return util.range(minValue, maxValue);
  } else {
    this.throw(
      'Invalid value "%s"',
      range
    );
  }
};

/**
 * Parses the step from a part string
 *
 * @this {Part}
 * @param {string} step The step string.
 * @return {number} The step value.
 */
Part.prototype.parseStep = function(step) {
  if (typeof step !== 'undefined') {
    var parsedStep = parseInt(step, 10);
    if (isNaN(parsedStep) || parsedStep < 1) {
      this.throw('Invalid interval step value "%s"', step);
    }
    return parsedStep;
  }
};

/**
 * Applies an interval step to a collection of values
 *
 * @this {Part}
 * @param {array} values A collection of numbers.
 * @param {number} step The step value.
 * @return {array} The resulting collection.
 */
Part.prototype.applyInterval = function(values, step) {
  if (step) {
    var minVal = values[0];
    values = values.filter(function(value) {
      return value % step === minVal % step || value === minVal;
    });
  }
  return values;
};

/**
 * Replaces the alternative representations of numbers in a string
 *
 * @this {Part}
 * @param {string} str The string to process.
 * @return {string} The processed string.
 */
Part.prototype.replaceAlternatives = function(str) {
  var unit = this.unit;
  if (unit.alt) {
    str = str.toUpperCase();
    for (var i = 0; i < unit.alt.length; i++) {
      str = str.replace(unit.alt[i], i + unit.min);
    }
  }
  return str;
};

/**
 * Finds an element from values that is outside of the range of this.unit
 *
 * @this {Part}
 * @param {array} values The values to test.
 * @return {mixed} An integer is a value out of range was found,
  *                otherwise undefined.
 */
Part.prototype.outOfRange = function(values) {
  var first = values[0];
  var last = values[values.length - 1];
  if (first < this.unit.min) {
    return first;
  } else if (last > this.unit.max) {
    return last;
  }
};

/**
 * Returns the smallest value in the range.
 *
 * @this {Part}
 * @return {number} The smallest value.
 */
Part.prototype.min = function() {
  return this.values[0];
};

/**
 * Returns the largest value in the range.
 *
 * @this {Part}
 * @return {number} The largest value.
 */
Part.prototype.max = function() {
  return this.values[this.values.length - 1];
};

/**
 * Returns true if range has all the values of the unit.
 *
 * @this {Part}
 * @return {boolean} true/false.
 */
Part.prototype.isFull = function() {
  return this.values.length === this.unit.max - this.unit.min + 1;
};

/**
 * Returns the difference between first and second elements in the range.
 *
 * @this {Part}
 * @return {boolean} true/false.
 */
Part.prototype.getStep = function() {
  if (this.values.length > 2) {
    var step = this.values[1] - this.values[0];
    if (step > 1) {
      return step;
    }
  }
};

/**
 * Returns true if the range can be represented as an interval.
 *
 * @this {Part}
 * @param {number} step The difference between numbers in the interval.
 * @return {boolean} true/false.
 */
Part.prototype.isInterval = function(step) {
  for (var i = 1; i < this.values.length; i++) {
    var prev = this.values[i - 1];
    var value = this.values[i];
    if (value - prev !== step) {
      return false;
    }
  }
  return true;
};

/**
 * Returns true if the range contains all the interval values.
 *
 * @this {Part}
 * @param {number} step The difference between numbers in the interval.
 * @return {boolean} true/false.
 */
Part.prototype.isFullInterval = function(step) {
  var unit = this.unit;
  var min = this.min();
  var max = this.max();
  var haveAllValues = this.values.length === (max - min) / step + 1;
  if (min === unit.min && max + step > unit.max && haveAllValues) {
    return true;
  }
  return false;
};

/**
 * Checks if the range contains the specified value
 *
 * @this {Part}
 * @param {number} value The value to look for.
 * @return {boolean} Whether the value is present in the range.
 */
Part.prototype.has = function(value) {
  return this.values.indexOf(value) > -1;
};

/**
 * Returns the range as an array of positive integers.
 *
 * @this {Part}
 * @return {array} The range as an array.
 */
Part.prototype.toArray = function() {
  return this.values;
};

/**
 * Returns the range as an array of ranges
 * defined as arrays of positive integers.
 *
 * @this {Part}
 * @return {array} The range as a multi-dimentional array.
 */
Part.prototype.toRanges = function() {
  var retval = [];
  var startPart = null;
  this.values.forEach(function(value, index, self) {
    if (value !== self[index + 1] - 1) {
      if (startPart !== null) {
        retval.push([startPart, value]);
        startPart = null;
      } else {
        retval.push(value);
      }
    } else if (startPart === null) {
      startPart = value;
    }
  });
  return retval;
};

/**
 * Returns the range as a string.
 *
 * @this {Part}
 * @return {string} The range as a string.
 */
Part.prototype.toString = function() {
  var retval = '';
  if (this.isFull()) {
    if (this.options.outputHashes) {
      retval = 'H';
    } else {
      retval = '*';
    }
  } else {
    var step = this.getStep();
    var format;
    if (step && this.isInterval(step)) {
      if (this.isFullInterval(step)) {
        if (this.options.outputHashes) {
          format = 'H/%d';
        } else {
          format = '*/%d';
        }
        retval = sprintf(format, step);
      } else {
        if (this.options.outputHashes) {
          format = 'H(%s-%s)/%d';
        } else {
          format = '%s-%s/%d';
        }
        retval = sprintf(
          format,
          this.formatValue(this.min()),
          this.formatValue(this.max()),
          step
        );
      }
    } else {
      retval = this.toRanges().map(function(range) {
        if (range.length) {
          return sprintf(
            '%s-%s',
            this.formatValue(range[0]),
            this.formatValue(range[1])
          );
        }
        return this.formatValue(range);
      }, this).join(',');
    }
  }
  return retval;
};

/**
 * Formats weekday and month names as string
 * when the relevant options are set.
 *
 * @param {number} value The value to process.
 * @return {mixed} The formatted string or number.
 */
Part.prototype.formatValue = function(value) {
  if (this.options.outputWeekdayNames && this.unit.name === 'weekday' ||
    this.options.outputMonthNames && this.unit.name === 'month') {
    return this.unit.alt[value - this.unit.min];
  }
  return value;
};

module.exports = Part;

},{"./util":7,"sprintf-js":17}],5:[function(require,module,exports){
'use strict';

var moment = require('moment-timezone');

/**
 * Creates an instance of Seeker.
 * Seeker objects search for execution times of a cron schedule.
 *
 * @constructor
 * @this {Seeker}
 */
function Seeker(cron, now) {
  if (cron.parts === null) {
    throw new Error('No schedule found');
  }
  var date;
  if (cron.options.timezone) {
    date = moment.tz(now, cron.options.timezone);
  } else {
    date = moment(now);
  }
  if (!date.isValid()) {
    throw new Error('Invalid date provided');
  }
  if (date.seconds() > 0) {
    // Add a minute to the date to prevent returning dates in the past
    date.add(1, 'minute');
  }
  this.cron = cron;
  this.now = date;
  this.date = date;
  this.pristine = true;
}

/**
 * Resets the iterator.
 *
 * @this {Seeker}
 */
Seeker.prototype.reset = function() {
  this.pristine = true;
  this.date = moment(this.now);
};

/**
 * Returns the time the schedule would run next.
 *
 * @this {Seeker}
 * @return {Date} The time the schedule would run next.
 */
Seeker.prototype.next = function() {
  if (this.pristine) {
    this.pristine = false;
  } else {
    this.date.add(1, 'minute');
  }
  return findDate(this.cron.parts, this.date);
};

/**
 * Returns the time the schedule would have last run at.
 *
 * @this {Seeker}
 * @return {Date} The time the schedule would have last run at.
 */
Seeker.prototype.prev = function() {
  this.pristine = false;
  return findDate(this.cron.parts, this.date, true);
};

/**
 * Returns the time the schedule would run next.
 *
 * @param {array} parts An array of Cron parts.
 * @param {Date} date The reference date.
 * @param {boolean} reverse Whether to find the previous value instead of next.
 * @return {Moment} The date the schedule would have executed at.
 */
var findDate = function(parts, date, reverse) {
  var operation = 'add';
  var reset = 'startOf';
  if (reverse) {
    operation = 'subtract';
    reset = 'endOf';
    date.subtract(1, 'minute'); // Ensure prev and next cannot be same time
  }
  var retry = 24;
  while (--retry) {
    shiftMonth(parts, date, operation, reset);
    var monthChanged = shiftDay(parts, date, operation, reset);
    if (!monthChanged) {
      var dayChanged = shiftHour(parts, date, operation, reset);
      if (!dayChanged) {
        var hourChanged = shiftMinute(parts, date, operation, reset);
        if (!hourChanged) {
          break;
        }
      }
    }
  }
  if (!retry) {
    throw new Error('Unable to find execution time for schedule');
  }
  date.seconds(0).milliseconds(0);
  // Return new moment object
  return moment(date);
};

/**
 * Increments/decrements the month value of a date,
 * until a month that matches the schedule is found
 *
 * @param {array} parts An array of Cron parts.
 * @param {Moment} date The date to shift.
 * @param {string} operation The function to call on date: 'add' or 'subtract'
 * @param {string} reset The function to call on date: 'startOf' or 'endOf'
 */
var shiftMonth = function(parts, date, operation, reset) {
  while (!parts[3].has(date.month() + 1)) {
    date[operation](1, 'months')[reset]('month');
  }
};

/**
 * Increments/decrements the day value of a date,
 * until a day that matches the schedule is found
 *
 * @param {array} parts An array of Cron parts.
 * @param {Moment} date The date to shift.
 * @param {string} operation The function to call on date: 'add' or 'subtract'
 * @param {string} reset The function to call on date: 'startOf' or 'endOf'
 * @return {boolean} Whether the month of the date was changed
 */
var shiftDay = function(parts, date, operation, reset) {
  var currentMonth = date.month();
  while (!parts[2].has(date.date()) || !parts[4].has(date.day())) {
    date[operation](1, 'days')[reset]('day');
    if (currentMonth !== date.month()) {
      return true;
    }
  }
  return false;
};

/**
 * Increments/decrements the hour value of a date,
 * until an hour that matches the schedule is found
 *
 * @param {array} parts An array of Cron parts.
 * @param {Moment} date The date to shift.
 * @param {string} operation The function to call on date: 'add' or 'subtract'
 * @param {string} reset The function to call on date: 'startOf' or 'endOf'
 * @return {boolean} Whether the day of the date was changed
 */
var shiftHour = function(parts, date, operation, reset) {
  var currentDay = date.date();
  while (!parts[1].has(date.hour())) {
    date[operation](1, 'hours')[reset]('hour');
    if (currentDay !== date.date()) {
      return true;
    }
  }
  return false;
};

/**
 * Increments/decrements the minute value of a date,
 * until an minute that matches the schedule is found
 *
 * @param {array} parts An array of Cron parts.
 * @param {Moment} date The date to shift.
 * @param {string} operation The function to call on date: 'add' or 'subtract'
 * @param {string} reset The function to call on date: 'startOf' or 'endOf'
 * @return {boolean} Whether the hour of the date was changed
 */
var shiftMinute = function(parts, date, operation, reset) {
  var currentHour = date.hour();
  while (!parts[0].has(date.minute())) {
    date[operation](1, 'minutes')[reset]('minute');
    if (currentHour !== date.hour()) {
      return true;
    }
  }
  return false;
};

module.exports = Seeker;

},{"moment-timezone":14}],6:[function(require,module,exports){
'use strict';

module.exports = [
  {
    name: 'minute',
    min: 0,
    max: 59
  },
  {
    name: 'hour',
    min: 0,
    max: 23
  },
  {
    name: 'day',
    min: 1,
    max: 31
  },
  {
    name: 'month',
    min: 1,
    max: 12,
    alt: [
      'JAN', 'FEB', 'MAR', 'APR',
      'MAY', 'JUN', 'JUL', 'AUG',
      'SEP', 'OCT', 'NOV', 'DEC'
    ]
  },
  {
    name: 'weekday',
    min: 0,
    max: 6,
    alt: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  }
];

},{}],7:[function(require,module,exports){
'use strict';

var util = {};

/**
 * Creates an array of integers from start to end, inclusive.
 *
 * @param {Number} start The first number in the range
 * @param {Number} end The last number in the range
 * @return {Array} The range, as an array of integers
 */
util.range = function(start, end) {
  var array = [];
  for (var i = start; i <= end; i++) {
    array.push(i);
  }
  return array;
};

/**
 * Sorts an array of numbers.
 *
 * @param {Array} array The array to sort
 * @return {Array} The sorted array
 */
util.sort = function(array) {
  array.sort(function(a, b) {
    return a - b;
  });
  return array;
};

/**
 * Flattens a 2-dimensional array
 *
 * @param {Array} arrays A 2-dimensional array
 * @return {Array} The flattened array
 */
util.flatten = function(arrays) {
  return [].concat.apply([], arrays);
};

/**
 * Removes duplicate entries from an array
 *
 * @param {Array} array An array
 * @return {Array} The de-duplicated array
 */
util.dedup = function(array) {
  var result = [];
  array.forEach(function(i) {
    if (result.indexOf(i) < 0) {
      result.push(i);
    }
  });
  return result;
};

module.exports = util;

},{}],8:[function(require,module,exports){
var pSlice = Array.prototype.slice;
var objectKeys = require('./lib/keys.js');
var isArguments = require('./lib/is_arguments.js');

var deepEqual = module.exports = function (actual, expected, opts) {
  if (!opts) opts = {};
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  } else if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();

  // 7.3. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (!actual || !expected || typeof actual != 'object' && typeof expected != 'object') {
    return opts.strict ? actual === expected : actual == expected;

  // 7.4. For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected, opts);
  }
}

function isUndefinedOrNull(value) {
  return value === null || value === undefined;
}

function isBuffer (x) {
  if (!x || typeof x !== 'object' || typeof x.length !== 'number') return false;
  if (typeof x.copy !== 'function' || typeof x.slice !== 'function') {
    return false;
  }
  if (x.length > 0 && typeof x[0] !== 'number') return false;
  return true;
}

function objEquiv(a, b, opts) {
  var i, key;
  if (isUndefinedOrNull(a) || isUndefinedOrNull(b))
    return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  //~~~I've managed to break Object.keys through screwy arguments passing.
  //   Converting to array solves the problem.
  if (isArguments(a)) {
    if (!isArguments(b)) {
      return false;
    }
    a = pSlice.call(a);
    b = pSlice.call(b);
    return deepEqual(a, b, opts);
  }
  if (isBuffer(a)) {
    if (!isBuffer(b)) {
      return false;
    }
    if (a.length !== b.length) return false;
    for (i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  try {
    var ka = objectKeys(a),
        kb = objectKeys(b);
  } catch (e) {//happens when one is a string literal and the other isn't
    return false;
  }
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!deepEqual(a[key], b[key], opts)) return false;
  }
  return typeof a === typeof b;
}

},{"./lib/is_arguments.js":9,"./lib/keys.js":10}],9:[function(require,module,exports){
var supportsArgumentsClass = (function(){
  return Object.prototype.toString.call(arguments)
})() == '[object Arguments]';

exports = module.exports = supportsArgumentsClass ? supported : unsupported;

exports.supported = supported;
function supported(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
};

exports.unsupported = unsupported;
function unsupported(object){
  return object &&
    typeof object == 'object' &&
    typeof object.length == 'number' &&
    Object.prototype.hasOwnProperty.call(object, 'callee') &&
    !Object.prototype.propertyIsEnumerable.call(object, 'callee') ||
    false;
};

},{}],10:[function(require,module,exports){
exports = module.exports = typeof Object.keys === 'function'
  ? Object.keys : shim;

exports.shim = shim;
function shim (obj) {
  var keys = [];
  for (var key in obj) keys.push(key);
  return keys;
}

},{}],11:[function(require,module,exports){
const Cron = require('cron-converter');
const equal = require('deep-equal');
const timezoneJS = require('timezone-js');
const tzdata = require('tzdata');

// instantiate cron converter
const cron = new Cron();
// load timezone data
const _tz = timezoneJS.timezone;
_tz.loadingScheme = _tz.loadingSchemes.MANUAL_LOAD;
_tz.loadZoneDataFromObject(tzdata);


const localCrontabToUtcCrontabs = (localCrontab, timezone) => {
  const localArrayCrontab = cron.fromString(localCrontab).toArray();
  let utcArrayCrontabs = [];
  for (const month of localArrayCrontab[3]) {
    for (const day of localArrayCrontab[2]) {
      // For now don't handle the hour between 12-1 when DST shift usually occurs
      const localDate = new timezoneJS.Date(
        new Date().getFullYear(), month-1, day, 12, 0, timezone);
      const offsetHours = Math.floor(localDate.getTimezoneOffset() / 60);
      const offsetMinutes = localDate.getTimezoneOffset() % 60;
      utcArrayCrontabs.push([
        localArrayCrontab[0].map((minute) => (minute + offsetMinutes + 60) % 60),
        localArrayCrontab[1].map((hour) => (hour + offsetHours + 24) % 24),
        [day],
        [month],
        localArrayCrontab[4]
      ]);
    }
  }
  // Group days together by month & hour/minute.
  utcArrayCrontabs = utcArrayCrontabs.reduce((acc, crontabArray) => {
    if (acc.length > 0 // not the 1st element
        &&
        equal(acc[acc.length-1][0], crontabArray[0]) // minute the same
        &&
        equal(acc[acc.length-1][1], crontabArray[1]) // hour the same
        &&
        equal(acc[acc.length-1][3], crontabArray[3]) // month the same
       ) {
      acc[acc.length-1][2].push(...crontabArray[2]);
    } else {
      acc.push(crontabArray)
    }
    return acc;
  }, []);
  // Group months together by hour/minute & days
  utcArrayCrontabs = utcArrayCrontabs.reduce((acc, crontabArray) => {
    if (acc.length > 0 // not the 1st element
        &&
        equal(acc[acc.length-1][0], crontabArray[0]) // minute the same
        &&
        equal(acc[acc.length-1][1], crontabArray[1]) // hour the same
        &&
        equal(acc[acc.length-1][2], crontabArray[2]) // days the same
       ) {
      acc[acc.length-1][3].push(...crontabArray[3]);
    } else {
      acc.push(crontabArray)
    }
    return acc;
  }, []);
  // combine start & end of year if possible
  if (utcArrayCrontabs.length > 1 // not the same crontab
      &&
      equal(utcArrayCrontabs[0][0], utcArrayCrontabs[utcArrayCrontabs.length-1][0])
      &&
      equal(utcArrayCrontabs[0][1], utcArrayCrontabs[utcArrayCrontabs.length-1][1]))
    utcArrayCrontabs[0][3].push(...utcArrayCrontabs.pop()[3]);
  // return converted back to crontabs from arrays
  return utcArrayCrontabs.map((arrayCrontab) => cron.fromArray(arrayCrontab).toString());
};

module.exports = localCrontabToUtcCrontabs;
module.exports.default = localCrontabToUtcCrontabs;
module.exports.localCrontabToUtcCrontabs = localCrontabToUtcCrontabs;

},{"cron-converter":3,"deep-equal":8,"timezone-js":18,"tzdata":19}],12:[function(require,module,exports){
/*!
 * Selectr 2.4.0
 * http://mobius.ovh/docs/selectr
 *
 * Released under the MIT license
 */
!function(e,t){"function"==typeof define&&define.amd?define([],t("Selectr")):"object"==typeof exports?module.exports=t("Selectr"):e.Selectr=t("Selectr")}(this,function(e){"use strict";function t(e,t){return e.hasOwnProperty(t)&&(!0===e[t]||e[t].length)}function i(e,t,i){e.parentNode?e.parentNode.parentNode||t.appendChild(e.parentNode):t.appendChild(e),a.removeClass(e,"excluded"),i||(e.innerHTML=e.textContent)}var s={defaultSelected:!0,width:"auto",disabled:!1,searchable:!0,clearable:!1,sortSelected:!1,allowDeselect:!1,closeOnScroll:!1,nativeDropdown:!1,placeholder:"Select an option...",taggable:!1,tagPlaceholder:"Enter a tag..."},n=function(){};n.prototype={on:function(e,t){this._events=this._events||{},this._events[e]=this._events[e]||[],this._events[e].push(t)},off:function(e,t){this._events=this._events||{},e in this._events!=!1&&this._events[e].splice(this._events[e].indexOf(t),1)},emit:function(e){if(this._events=this._events||{},e in this._events!=!1)for(var t=0;t<this._events[e].length;t++)this._events[e][t].apply(this,Array.prototype.slice.call(arguments,1))}},n.mixin=function(e){for(var t=["on","off","emit"],i=0;i<t.length;i++)"function"==typeof e?e.prototype[t[i]]=n.prototype[t[i]]:e[t[i]]=n.prototype[t[i]];return e};var a={extend:function(e,t){t=t||{};var i;for(i in e)e.hasOwnProperty(i)&&(t.hasOwnProperty(i)||(t[i]=e[i]));return t},each:function(e,t,i){if("[object Object]"===Object.prototype.toString.call(e))for(var s in e)Object.prototype.hasOwnProperty.call(e,s)&&t.call(i,s,e[s],e);else for(var n=0,a=e.length;n<a;n++)t.call(i,n,e[n],e)},createElement:function(e,t){var i=document,s=i.createElement(e);if(t&&"[object Object]"===Object.prototype.toString.call(t)){var n;for(n in t)if(n in s)s[n]=t[n];else if("html"===n)s.innerHTML=t[n];else if("text"===n){var a=i.createTextNode(t[n]);s.appendChild(a)}else s.setAttribute(n,t[n])}return s},hasClass:function(e,t){if(e)return e.classList?e.classList.contains(t):!!e.className&&!!e.className.match(new RegExp("(\\s|^)"+t+"(\\s|$)"))},addClass:function(e,t){a.hasClass(e,t)||(e.classList?e.classList.add(t):e.className=e.className.trim()+" "+t)},removeClass:function(e,t){a.hasClass(e,t)&&(e.classList?e.classList.remove(t):e.className=e.className.replace(new RegExp("(^|\\s)"+t.split(" ").join("|")+"(\\s|$)","gi")," "))},closest:function(e,t){return e&&e!==document.body&&(t(e)?e:a.closest(e.parentNode,t))},isInt:function(e){return"number"==typeof e&&isFinite(e)&&Math.floor(e)===e},debounce:function(e,t,i){var s;return function(){var n=this,a=arguments,l=i&&!s;clearTimeout(s),s=setTimeout(function(){s=null,i||e.apply(n,a)},t),l&&e.apply(n,a)}},rect:function(e,t){var i=window,s=e.getBoundingClientRect(),n=t?i.pageXOffset:0,a=t?i.pageYOffset:0;return{bottom:s.bottom+a,height:s.height,left:s.left+n,right:s.right+n,top:s.top+a,width:s.width}},includes:function(e,t){return e.indexOf(t)>-1},truncate:function(e){for(;e.firstChild;)e.removeChild(e.firstChild)}},l=function(){if(this.items.length){var e=document.createDocumentFragment();if(this.config.pagination){var t=this.pages.slice(0,this.pageIndex);a.each(t,function(t,s){a.each(s,function(t,s){i(s,e,this.customOption)},this)},this)}else a.each(this.items,function(t,s){i(s,e,this.customOption)},this);e.childElementCount&&(a.removeClass(this.items[this.navIndex],"active"),this.navIndex=e.querySelector(".selectr-option").idx,a.addClass(this.items[this.navIndex],"active")),this.tree.appendChild(e)}},o=function(e){var t=e.target;this.container.contains(t)||!this.opened&&!a.hasClass(this.container,"notice")||this.close()},h=function(e,t){t=t||e;var i=this.customOption?this.config.renderOption(t):e.textContent,s=a.createElement("li",{class:"selectr-option",html:i,role:"treeitem","aria-selected":!1});return s.idx=e.idx,this.items.push(s),e.defaultSelected&&this.defaultSelected.push(e.idx),e.disabled&&(s.disabled=!0,a.addClass(s,"disabled")),s},c=function(){this.requiresPagination=this.config.pagination&&this.config.pagination>0,t(this.config,"width")&&(a.isInt(this.config.width)?this.width=this.config.width+"px":"auto"===this.config.width?this.width="100%":a.includes(this.config.width,"%")&&(this.width=this.config.width)),this.container=a.createElement("div",{class:"selectr-container"}),this.config.customClass&&a.addClass(this.container,this.config.customClass),this.mobileDevice?a.addClass(this.container,"selectr-mobile"):a.addClass(this.container,"selectr-desktop"),this.el.tabIndex=-1,this.config.nativeDropdown||this.mobileDevice?a.addClass(this.el,"selectr-visible"):a.addClass(this.el,"selectr-hidden"),this.selected=a.createElement("div",{class:"selectr-selected",disabled:this.disabled,tabIndex:1,"aria-expanded":!1}),this.label=a.createElement(this.el.multiple?"ul":"span",{class:"selectr-label"});var e=a.createElement("div",{class:"selectr-options-container"});if(this.tree=a.createElement("ul",{class:"selectr-options",role:"tree","aria-hidden":!0,"aria-expanded":!1}),this.notice=a.createElement("div",{class:"selectr-notice"}),this.el.setAttribute("aria-hidden",!0),this.disabled&&(this.el.disabled=!0),this.el.multiple&&(a.addClass(this.label,"selectr-tags"),a.addClass(this.container,"multiple"),this.tags=[],this.selectedValues=this.getSelectedProperties("value"),this.selectedIndexes=this.getSelectedProperties("idx")),this.selected.appendChild(this.label),this.config.clearable&&(this.selectClear=a.createElement("button",{class:"selectr-clear",type:"button"}),this.container.appendChild(this.selectClear),a.addClass(this.container,"clearable")),this.config.taggable){var i=a.createElement("li",{class:"input-tag"});this.input=a.createElement("input",{class:"selectr-tag-input",placeholder:this.config.tagPlaceholder,tagIndex:0,autocomplete:"off",autocorrect:"off",autocapitalize:"off",spellcheck:"false",role:"textbox",type:"search"}),i.appendChild(this.input),this.label.appendChild(i),a.addClass(this.container,"taggable"),this.tagSeperators=[","],this.config.tagSeperators&&(this.tagSeperators=this.tagSeperators.concat(this.config.tagSeperators))}this.config.searchable&&(this.input=a.createElement("input",{class:"selectr-input",tagIndex:-1,autocomplete:"off",autocorrect:"off",autocapitalize:"off",spellcheck:"false",role:"textbox",type:"search"}),this.inputClear=a.createElement("button",{class:"selectr-input-clear",type:"button"}),this.inputContainer=a.createElement("div",{class:"selectr-input-container"}),this.inputContainer.appendChild(this.input),this.inputContainer.appendChild(this.inputClear),e.appendChild(this.inputContainer)),e.appendChild(this.notice),e.appendChild(this.tree),this.items=[],this.options=[],this.el.options.length&&(this.options=[].slice.call(this.el.options));var s=!1,n=0;if(this.el.children.length&&a.each(this.el.children,function(e,t){"OPTGROUP"===t.nodeName?(s=a.createElement("ul",{class:"selectr-optgroup",role:"group",html:"<li class='selectr-optgroup--label'>"+t.label+"</li>"}),a.each(t.children,function(e,t){t.idx=n,s.appendChild(h.call(this,t,s)),n++},this)):(t.idx=n,h.call(this,t),n++)},this),this.config.data&&Array.isArray(this.config.data)){this.data=[];var l,o=!1;s=!1,n=0,a.each(this.config.data,function(e,i){t(i,"children")?(o=a.createElement("optgroup",{label:i.text}),s=a.createElement("ul",{class:"selectr-optgroup",role:"group",html:"<li class='selectr-optgroup--label'>"+i.text+"</li>"}),a.each(i.children,function(e,i){(l=new Option(i.text,i.value,!1,i.hasOwnProperty("selected")&&!0===i.selected)).disabled=t(i,"disabled"),this.options.push(l),o.appendChild(l),l.idx=n,s.appendChild(h.call(this,l,i)),this.data[n]=i,n++},this)):((l=new Option(i.text,i.value,!1,i.hasOwnProperty("selected")&&!0===i.selected)).disabled=t(i,"disabled"),this.options.push(l),l.idx=n,h.call(this,l,i),this.data[n]=i,n++)},this)}this.setSelected(!0);var c;this.navIndex=0;for(var r=0;r<this.items.length;r++)if(c=this.items[r],!a.hasClass(c,"disabled")){a.addClass(c,"active"),this.navIndex=r;break}this.requiresPagination&&(this.pageIndex=1,this.paginate()),this.container.appendChild(this.selected),this.container.appendChild(e),this.placeEl=a.createElement("div",{class:"selectr-placeholder"}),this.setPlaceholder(),this.selected.appendChild(this.placeEl),this.disabled&&this.disable(),this.el.parentNode.insertBefore(this.container,this.el),this.container.appendChild(this.el)},r=function(e){if(e=e||window.event,this.items.length&&this.opened&&a.includes([13,38,40],e.which)){if(e.preventDefault(),13===e.which)return!(this.config.taggable&&this.input.value.length>0)&&this.change(this.navIndex);var t,i=this.items[this.navIndex];switch(e.which){case 38:t=0,this.navIndex>0&&this.navIndex--;break;case 40:t=1,this.navIndex<this.items.length-1&&this.navIndex++}for(this.navigating=!0;a.hasClass(this.items[this.navIndex],"disabled")||a.hasClass(this.items[this.navIndex],"excluded");)if(t?this.navIndex++:this.navIndex--,this.searching){if(this.navIndex>this.tree.lastElementChild.idx){this.navIndex=this.tree.lastElementChild.idx;break}if(this.navIndex<this.tree.firstElementChild.idx){this.navIndex=this.tree.firstElementChild.idx;break}}var s=a.rect(this.items[this.navIndex]);t?(0===this.navIndex?this.tree.scrollTop=0:s.top+s.height>this.optsRect.top+this.optsRect.height&&(this.tree.scrollTop=this.tree.scrollTop+(s.top+s.height-(this.optsRect.top+this.optsRect.height))),this.navIndex===this.tree.childElementCount-1&&this.requiresPagination&&u.call(this)):0===this.navIndex?this.tree.scrollTop=0:s.top-this.optsRect.top<0&&(this.tree.scrollTop=this.tree.scrollTop+(s.top-this.optsRect.top)),i&&a.removeClass(i,"active"),a.addClass(this.items[this.navIndex],"active")}else this.navigating=!1},d=function(e){var t,i=this,s=document.createDocumentFragment(),n=this.options[e.idx],l=this.data?this.data[e.idx]:n,o=this.customSelected?this.config.renderSelection(l):n.textContent,h=a.createElement("li",{class:"selectr-tag",html:o}),c=a.createElement("button",{class:"selectr-tag-remove",type:"button"});if(h.appendChild(c),h.idx=e.idx,h.tag=n.value,this.tags.push(h),this.config.sortSelected){var r=this.tags.slice();t=function(e,t){e.replace(/(\d+)|(\D+)/g,function(e,i,s){t.push([i||1/0,s||""])})},r.sort(function(e,s){var n,a,l=[],o=[];for(!0===i.config.sortSelected?(n=e.tag,a=s.tag):"text"===i.config.sortSelected&&(n=e.textContent,a=s.textContent),t(n,l),t(a,o);l.length&&o.length;){var h=l.shift(),c=o.shift(),r=h[0]-c[0]||h[1].localeCompare(c[1]);if(r)return r}return l.length-o.length}),a.each(r,function(e,t){s.appendChild(t)}),this.label.innerHTML=""}else s.appendChild(h);this.config.taggable?this.label.insertBefore(s,this.input.parentNode):this.label.appendChild(s)},p=function(e){var t=!1;a.each(this.tags,function(i,s){s.idx===e.idx&&(t=s)},this),t&&(this.label.removeChild(t),this.tags.splice(this.tags.indexOf(t),1))},u=function(){var e=this.tree;if(e.scrollTop>=e.scrollHeight-e.offsetHeight&&this.pageIndex<this.pages.length){var t=document.createDocumentFragment();a.each(this.pages[this.pageIndex],function(e,s){i(s,t,this.customOption)},this),e.appendChild(t),this.pageIndex++,this.emit("selectr.paginate",{items:this.items.length,total:this.data.length,page:this.pageIndex,pages:this.pages.length})}},f=function(){(this.config.searchable||this.config.taggable)&&(this.input.value=null,this.searching=!1,this.config.searchable&&a.removeClass(this.inputContainer,"active"),a.hasClass(this.container,"notice")&&(a.removeClass(this.container,"notice"),a.addClass(this.container,"open"),this.input.focus()),a.each(this.items,function(e,t){a.removeClass(t,"excluded"),this.customOption||(t.innerHTML=t.textContent)},this))},g=function(e,t){var i=new RegExp(e,"i").exec(t.textContent);return!!i&&t.textContent.replace(i[0],"<span class='selectr-match'>"+i[0]+"</span>")},v=function(e,t){if(t=t||{},!e)throw new Error("You must supply either a HTMLSelectElement or a CSS3 selector string.");if(this.el=e,"string"==typeof e&&(this.el=document.querySelector(e)),null===this.el)throw new Error("The element you passed to Selectr can not be found.");if("select"!==this.el.nodeName.toLowerCase())throw new Error("The element you passed to Selectr is not a HTMLSelectElement.");this.render(t)};return v.prototype.render=function(e){if(!this.rendered){this.config=a.extend(s,e),this.originalType=this.el.type,this.originalIndex=this.el.tabIndex,this.defaultSelected=[],this.originalOptionCount=this.el.options.length,(this.config.multiple||this.config.taggable)&&(this.el.multiple=!0),this.disabled=t(this.config,"disabled"),this.opened=!1,this.config.taggable&&(this.config.searchable=!1),this.navigating=!1,this.mobileDevice=!1,/Android|webOS|iPhone|iPad|BlackBerry|Windows Phone|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent)&&(this.mobileDevice=!0),this.customOption=this.config.hasOwnProperty("renderOption")&&"function"==typeof this.config.renderOption,this.customSelected=this.config.hasOwnProperty("renderSelection")&&"function"==typeof this.config.renderSelection,n.mixin(this),c.call(this),this.bindEvents(),this.update(),this.optsRect=a.rect(this.tree),this.rendered=!0,this.el.multiple||(this.el.selectedIndex=this.selectedIndex);var i=this;setTimeout(function(){i.emit("selectr.init")},20)}},v.prototype.getSelected=function(){return this.el.querySelectorAll("option:checked")},v.prototype.getSelectedProperties=function(e){var t=this.getSelected();return[].slice.call(t).map(function(t){return t[e]}).filter(function(e){return!!e})},v.prototype.bindEvents=function(){var e=this;if(this.events={},this.events.dismiss=o.bind(this),this.events.navigate=r.bind(this),this.events.reset=this.reset.bind(this),this.config.nativeDropdown||this.mobileDevice){this.container.addEventListener("touchstart",function(t){t.changedTouches[0].target===e.el&&e.toggle()}),(this.config.nativeDropdown||this.mobileDevice)&&this.container.addEventListener("click",function(t){t.target===e.el&&e.toggle()});var t=function(e,t){for(var i,s=[],n=e.slice(0),a=0;a<t.length;a++)(i=n.indexOf(t[a]))>-1?n.splice(i,1):s.push(t[a]);return[s,n]};this.el.addEventListener("change",function(i){if(e.el.multiple){var s=e.getSelectedProperties("idx"),n=t(e.selectedIndexes,s);a.each(n[0],function(t,i){e.select(i)},e),a.each(n[1],function(t,i){e.deselect(i)},e)}else e.el.selectedIndex>-1&&e.select(e.el.selectedIndex)})}this.config.nativeDropdown&&this.container.addEventListener("keydown",function(t){"Enter"===t.key&&e.selected===document.activeElement&&(e.toggle(),setTimeout(function(){e.el.focus()},200))}),this.selected.addEventListener("click",function(t){e.disabled||e.toggle(),t.preventDefault()}),this.label.addEventListener("click",function(t){a.hasClass(t.target,"selectr-tag-remove")&&e.deselect(t.target.parentNode.idx)}),this.selectClear&&this.selectClear.addEventListener("click",this.clear.bind(this)),this.tree.addEventListener("mousedown",function(e){e.preventDefault()}),this.tree.addEventListener("click",function(t){var i=a.closest(t.target,function(e){return e&&a.hasClass(e,"selectr-option")});i&&(a.hasClass(i,"disabled")||(a.hasClass(i,"selected")?(e.el.multiple||!e.el.multiple&&e.config.allowDeselect)&&e.deselect(i.idx):e.select(i.idx),e.opened&&!e.el.multiple&&e.close()))}),this.tree.addEventListener("mouseover",function(t){a.hasClass(t.target,"selectr-option")&&(a.hasClass(t.target,"disabled")||(a.removeClass(e.items[e.navIndex],"active"),a.addClass(t.target,"active"),e.navIndex=[].slice.call(e.items).indexOf(t.target)))}),this.config.searchable&&(this.input.addEventListener("focus",function(t){e.searching=!0}),this.input.addEventListener("blur",function(t){e.searching=!1}),this.input.addEventListener("keyup",function(t){e.search(),e.config.taggable||(this.value.length?a.addClass(this.parentNode,"active"):a.removeClass(this.parentNode,"active"))}),this.inputClear.addEventListener("click",function(t){e.input.value=null,f.call(e),e.tree.childElementCount||l.call(e)})),this.config.taggable&&this.input.addEventListener("keyup",function(t){if(e.search(),e.config.taggable&&this.value.length){var i=this.value.trim();(13===t.which||a.includes(e.tagSeperators,t.key))&&(a.each(e.tagSeperators,function(e,t){i=i.replace(t,"")}),e.add({value:i,text:i,selected:!0},!0)?(e.close(),f.call(e)):(this.value="",e.setMessage("That tag is already in use.")))}}),this.update=a.debounce(function(){e.opened&&e.config.closeOnScroll&&e.close(),e.width&&(e.container.style.width=e.width),e.invert()},50),this.requiresPagination&&(this.paginateItems=a.debounce(function(){u.call(this)},50),this.tree.addEventListener("scroll",this.paginateItems.bind(this))),document.addEventListener("click",this.events.dismiss),window.addEventListener("keydown",this.events.navigate),window.addEventListener("resize",this.update),window.addEventListener("scroll",this.update),this.el.form&&this.el.form.addEventListener("reset",this.events.reset)},v.prototype.setSelected=function(e){if(this.config.data||this.el.multiple||!this.el.options.length||(0===this.el.selectedIndex&&(this.el.options[0].defaultSelected||this.config.defaultSelected||(this.el.selectedIndex=-1)),this.selectedIndex=this.el.selectedIndex,this.selectedIndex>-1&&this.select(this.selectedIndex)),this.config.multiple&&"select-one"===this.originalType&&!this.config.data&&this.el.options[0].selected&&!this.el.options[0].defaultSelected&&(this.el.options[0].selected=!1),a.each(this.options,function(e,t){t.selected&&t.defaultSelected&&this.select(t.idx)},this),this.config.selectedValue&&this.setValue(this.config.selectedValue),this.config.data){!this.el.multiple&&this.config.defaultSelected&&this.el.selectedIndex<0&&this.select(0);var i=0;a.each(this.config.data,function(e,s){t(s,"children")?a.each(s.children,function(e,t){t.hasOwnProperty("selected")&&!0===t.selected&&this.select(i),i++},this):(s.hasOwnProperty("selected")&&!0===s.selected&&this.select(i),i++)},this)}},v.prototype.destroy=function(){this.rendered&&(this.emit("selectr.destroy"),"select-one"===this.originalType&&(this.el.multiple=!1),this.config.data&&(this.el.innerHTML=""),a.removeClass(this.el,"selectr-hidden"),this.el.form&&a.off(this.el.form,"reset",this.events.reset),a.off(document,"click",this.events.dismiss),a.off(document,"keydown",this.events.navigate),a.off(window,"resize",this.update),a.off(window,"scroll",this.update),this.container.parentNode.replaceChild(this.el,this.container),this.rendered=!1)},v.prototype.change=function(e){var t=this.items[e],i=this.options[e];i.disabled||(i.selected&&a.hasClass(t,"selected")?this.deselect(e):this.select(e),this.opened&&!this.el.multiple&&this.close())},v.prototype.select=function(e){var t=this.items[e],i=[].slice.call(this.el.options),s=this.options[e];if(this.el.multiple){if(a.includes(this.selectedIndexes,e))return!1;if(this.config.maxSelections&&this.tags.length===this.config.maxSelections)return this.setMessage("A maximum of "+this.config.maxSelections+" items can be selected.",!0),!1;this.selectedValues.push(s.value),this.selectedIndexes.push(e),d.call(this,t)}else{var n=this.data?this.data[e]:s;this.label.innerHTML=this.customSelected?this.config.renderSelection(n):s.textContent,this.selectedValue=s.value,this.selectedIndex=e,a.each(this.options,function(t,i){var s=this.items[t];t!==e&&(s&&a.removeClass(s,"selected"),i.selected=!1,i.removeAttribute("selected"))},this)}a.includes(i,s)||this.el.add(s),t.setAttribute("aria-selected",!0),a.addClass(t,"selected"),a.addClass(this.container,"has-selected"),s.selected=!0,s.setAttribute("selected",""),this.emit("selectr.change",s),this.emit("selectr.select",s)},v.prototype.deselect=function(e,t){var i=this.items[e],s=this.options[e];if(this.el.multiple){var n=this.selectedIndexes.indexOf(e);this.selectedIndexes.splice(n,1);var l=this.selectedValues.indexOf(s.value);this.selectedValues.splice(l,1),p.call(this,i),this.tags.length||a.removeClass(this.container,"has-selected")}else{if(!t&&!this.config.clearable&&!this.config.allowDeselect)return!1;this.label.innerHTML="",this.selectedValue=null,this.el.selectedIndex=this.selectedIndex=-1,a.removeClass(this.container,"has-selected")}this.items[e].setAttribute("aria-selected",!1),a.removeClass(this.items[e],"selected"),s.selected=!1,s.removeAttribute("selected"),this.emit("selectr.change",null),this.emit("selectr.deselect",s)},v.prototype.setValue=function(e){var t=Array.isArray(e);if(t||(e=e.toString().trim()),!this.el.multiple&&t)return!1;a.each(this.options,function(i,s){(t&&a.includes(e.toString(),s.value)||s.value===e)&&this.change(s.idx)},this)},v.prototype.getValue=function(e,t){var i;if(this.el.multiple)e?this.selectedIndexes.length&&((i={}).values=[],a.each(this.selectedIndexes,function(e,t){var s=this.options[t];i.values[e]={value:s.value,text:s.textContent}},this)):i=this.selectedValues.slice();else if(e){var s=this.options[this.selectedIndex];i={value:s.value,text:s.textContent}}else i=this.selectedValue;return e&&t&&(i=JSON.stringify(i)),i},v.prototype.add=function(e,t){if(e){if(this.data=this.data||[],this.items=this.items||[],this.options=this.options||[],Array.isArray(e))a.each(e,function(e,i){this.add(i,t)},this);else if("[object Object]"===Object.prototype.toString.call(e)){if(t){var i=!1;if(a.each(this.options,function(t,s){s.value.toLowerCase()===e.value.toLowerCase()&&(i=!0)}),i)return!1}var s=a.createElement("option",e);return this.data.push(e),this.options.push(s),s.idx=this.options.length>0?this.options.length-1:0,h.call(this,s),e.selected&&this.select(s.idx),s}return this.setPlaceholder(),this.config.pagination&&this.paginate(),!0}},v.prototype.remove=function(e){var t=[];if(Array.isArray(e)?a.each(e,function(i,s){a.isInt(s)?t.push(this.getOptionByIndex(s)):"string"==typeof e&&t.push(this.getOptionByValue(s))},this):a.isInt(e)?t.push(this.getOptionByIndex(e)):"string"==typeof e&&t.push(this.getOptionByValue(e)),t.length){var i;a.each(t,function(e,t){i=t.idx,this.el.remove(t),this.options.splice(i,1);var s=this.items[i].parentNode;s&&s.removeChild(this.items[i]),this.items.splice(i,1),a.each(this.options,function(e,t){t.idx=e,this.items[e].idx=e},this)},this),this.setPlaceholder(),this.config.pagination&&this.paginate()}},v.prototype.removeAll=function(){this.clear(!0),a.each(this.el.options,function(e,t){this.el.remove(t)},this),a.truncate(this.tree),this.items=[],this.options=[],this.data=[],this.navIndex=0,this.requiresPagination&&(this.requiresPagination=!1,this.pageIndex=1,this.pages=[]),this.setPlaceholder()},v.prototype.search=function(e){if(!this.navigating){e=e||this.input.value;var t=document.createDocumentFragment();if(this.removeMessage(),a.truncate(this.tree),e.length>1)if(a.each(this.options,function(s,n){var l=this.items[n.idx];a.includes(n.textContent.toLowerCase(),e.toLowerCase())&&!n.disabled?(i(l,t,this.customOption),a.removeClass(l,"excluded"),this.customOption||(l.innerHTML=g(e,n))):a.addClass(l,"excluded")},this),t.childElementCount){var s=this.items[this.navIndex],n=t.firstElementChild;a.removeClass(s,"active"),this.navIndex=n.idx,a.addClass(n,"active")}else this.config.taggable||this.setMessage("no results.");else l.call(this);this.tree.appendChild(t)}},v.prototype.toggle=function(){this.disabled||(this.opened?this.close():this.open())},v.prototype.open=function(){var e=this;return!!this.options.length&&(this.opened||this.emit("selectr.open"),this.opened=!0,this.mobileDevice||this.config.nativeDropdown?(a.addClass(this.container,"native-open"),void(this.config.data&&a.each(this.options,function(e,t){this.el.add(t)},this))):(a.addClass(this.container,"open"),l.call(this),this.invert(),this.tree.scrollTop=0,a.removeClass(this.container,"notice"),this.selected.setAttribute("aria-expanded",!0),this.tree.setAttribute("aria-hidden",!1),this.tree.setAttribute("aria-expanded",!0),void(this.config.searchable&&!this.config.taggable&&setTimeout(function(){e.input.focus(),e.input.tabIndex=0},10))))},v.prototype.close=function(){if(this.opened&&this.emit("selectr.close"),this.opened=!1,this.mobileDevice||this.config.nativeDropdown)a.removeClass(this.container,"native-open");else{var e=a.hasClass(this.container,"notice");this.config.searchable&&!e&&(this.input.blur(),this.input.tabIndex=-1,this.searching=!1),e&&(a.removeClass(this.container,"notice"),this.notice.textContent=""),a.removeClass(this.container,"open"),a.removeClass(this.container,"native-open"),this.selected.setAttribute("aria-expanded",!1),this.tree.setAttribute("aria-hidden",!0),this.tree.setAttribute("aria-expanded",!1),a.truncate(this.tree),f.call(this)}},v.prototype.enable=function(){this.disabled=!1,this.el.disabled=!1,this.selected.tabIndex=this.originalIndex,this.el.multiple&&a.each(this.tags,function(e,t){t.lastElementChild.tabIndex=0}),a.removeClass(this.container,"selectr-disabled")},v.prototype.disable=function(e){e||(this.el.disabled=!0),this.selected.tabIndex=-1,this.el.multiple&&a.each(this.tags,function(e,t){t.lastElementChild.tabIndex=-1}),this.disabled=!0,a.addClass(this.container,"selectr-disabled")},v.prototype.reset=function(){this.disabled||(this.clear(),this.setSelected(!0),a.each(this.defaultSelected,function(e,t){this.select(t)},this),this.emit("selectr.reset"))},v.prototype.clear=function(e){if(this.el.multiple){if(this.selectedIndexes.length){var t=this.selectedIndexes.slice();a.each(t,function(e,t){this.deselect(t)},this)}}else this.selectedIndex>-1&&this.deselect(this.selectedIndex,e);this.emit("selectr.clear")},v.prototype.serialise=function(e){var t=[];return a.each(this.options,function(e,i){var s={value:i.value,text:i.textContent};i.selected&&(s.selected=!0),i.disabled&&(s.disabled=!0),t[e]=s}),e?JSON.stringify(t):t},v.prototype.serialize=function(e){return this.serialise(e)},v.prototype.setPlaceholder=function(e){e=e||this.config.placeholder||this.el.getAttribute("placeholder"),this.options.length||(e="No options available"),this.placeEl.innerHTML=e},v.prototype.paginate=function(){if(this.items.length){var e=this;return this.pages=this.items.map(function(t,i){return i%e.config.pagination==0?e.items.slice(i,i+e.config.pagination):null}).filter(function(e){return e}),this.pages}},v.prototype.setMessage=function(e,t){t&&this.close(),a.addClass(this.container,"notice"),this.notice.textContent=e},v.prototype.removeMessage=function(){a.removeClass(this.container,"notice"),this.notice.innerHTML=""},v.prototype.invert=function(){var e=a.rect(this.selected),t=this.tree.parentNode.offsetHeight,i=window.innerHeight;e.top+e.height+t>i?(a.addClass(this.container,"inverted"),this.isInverted=!0):(a.removeClass(this.container,"inverted"),this.isInverted=!1),this.optsRect=a.rect(this.tree)},v.prototype.getOptionByIndex=function(e){return this.options[e]},v.prototype.getOptionByValue=function(e){for(var t=!1,i=0,s=this.options.length;i<s;i++)if(this.options[i].value.trim()===e.toString().trim()){t=this.options[i];break}return t},v});
},{}],13:[function(require,module,exports){
module.exports={
	"version": "2017c",
	"zones": [
		"Africa/Abidjan|LMT GMT|g.8 0|01|-2ldXH.Q|48e5",
		"Africa/Accra|LMT GMT +0020|.Q 0 -k|012121212121212121212121212121212121212121212121|-26BbX.8 6tzX.8 MnE 1BAk MnE 1BAk MnE 1BAk MnE 1C0k MnE 1BAk MnE 1BAk MnE 1BAk MnE 1C0k MnE 1BAk MnE 1BAk MnE 1BAk MnE 1C0k MnE 1BAk MnE 1BAk MnE 1BAk MnE 1C0k MnE 1BAk MnE 1BAk MnE 1BAk MnE 1C0k MnE 1BAk MnE 1BAk MnE|41e5",
		"Africa/Nairobi|LMT EAT +0230 +0245|-2r.g -30 -2u -2J|01231|-1F3Cr.g 3Dzr.g okMu MFXJ|47e5",
		"Africa/Algiers|PMT WET WEST CET CEST|-9.l 0 -10 -10 -20|0121212121212121343431312123431213|-2nco9.l cNb9.l HA0 19A0 1iM0 11c0 1oo0 Wo0 1rc0 QM0 1EM0 UM0 DA0 Imo0 rd0 De0 9Xz0 1fb0 1ap0 16K0 2yo0 mEp0 hwL0 jxA0 11A0 dDd0 17b0 11B0 1cN0 2Dy0 1cN0 1fB0 1cL0|26e5",
		"Africa/Lagos|LMT WAT|-d.A -10|01|-22y0d.A|17e6",
		"Africa/Bissau|LMT -01 GMT|12.k 10 0|012|-2ldWV.E 2xonV.E|39e4",
		"Africa/Maputo|LMT CAT|-2a.k -20|01|-2GJea.k|26e5",
		"Africa/Cairo|EET EEST|-20 -30|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-1bIO0 vb0 1ip0 11z0 1iN0 1nz0 12p0 1pz0 10N0 1pz0 16p0 1jz0 s3d0 Vz0 1oN0 11b0 1oO0 10N0 1pz0 10N0 1pb0 10N0 1pb0 10N0 1pb0 10N0 1pz0 10N0 1pb0 10N0 1pb0 11d0 1oL0 11d0 1pb0 11d0 1oL0 11d0 1oL0 11d0 1oL0 11d0 1pb0 11d0 1oL0 11d0 1oL0 11d0 1oL0 11d0 1pb0 11d0 1oL0 11d0 1oL0 11d0 1oL0 11d0 1pb0 11d0 1oL0 11d0 1WL0 rd0 1Rz0 wp0 1pb0 11d0 1oL0 11d0 1oL0 11d0 1oL0 11d0 1pb0 11d0 1qL0 Xd0 1oL0 11d0 1oL0 11d0 1pb0 11d0 1oL0 11d0 1oL0 11d0 1ny0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 WL0 1qN0 Rb0 1wp0 On0 1zd0 Lz0 1EN0 Fb0 c10 8n0 8Nd0 gL0 e10 mn0|15e6",
		"Africa/Casablanca|LMT WET WEST CET|u.k 0 -10 -10|0121212121212121213121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2gMnt.E 130Lt.E rb0 Dd0 dVb0 b6p0 TX0 EoB0 LL0 gnd0 rz0 43d0 AL0 1Nd0 XX0 1Cp0 pz0 dEp0 4mn0 SyN0 AL0 1Nd0 wn0 1FB0 Db0 1zd0 Lz0 1Nf0 wM0 co0 go0 1o00 s00 dA0 vc0 11A0 A00 e00 y00 11A0 uM0 e00 Dc0 11A0 s00 e00 IM0 WM0 mo0 gM0 LA0 WM0 jA0 e00 Rc0 11A0 e00 e00 U00 11A0 8o0 e00 11A0 11A0 5A0 e00 17c0 1fA0 1a00 1a00 1fA0 17c0 1io0 14o0 1lc0 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1lc0 14o0 1fA0|32e5",
		"Africa/Ceuta|WET WEST CET CEST|0 -10 -10 -20|010101010101010101010232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232|-25KN0 11z0 drd0 18p0 3HX0 17d0 1fz0 1a10 1io0 1a00 1y7o0 LL0 gnd0 rz0 43d0 AL0 1Nd0 XX0 1Cp0 pz0 dEp0 4VB0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|85e3",
		"Africa/El_Aaiun|LMT -01 WET WEST|Q.M 10 0 -10|01232323232323232323232323232323232323232323232323232323232323232323232323232323232323232|-1rDz7.c 1GVA7.c 6L0 AL0 1Nd0 XX0 1Cp0 pz0 1cBB0 AL0 1Nd0 wn0 1FB0 Db0 1zd0 Lz0 1Nf0 wM0 co0 go0 1o00 s00 dA0 vc0 11A0 A00 e00 y00 11A0 uM0 e00 Dc0 11A0 s00 e00 IM0 WM0 mo0 gM0 LA0 WM0 jA0 e00 Rc0 11A0 e00 e00 U00 11A0 8o0 e00 11A0 11A0 5A0 e00 17c0 1fA0 1a00 1a00 1fA0 17c0 1io0 14o0 1lc0 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1lc0 14o0 1fA0|20e4",
		"Africa/Johannesburg|SAST SAST SAST|-1u -20 -30|012121|-2GJdu 1Ajdu 1cL0 1cN0 1cL0|84e5",
		"Africa/Juba|LMT CAT CAST EAT|-26.s -20 -30 -30|01212121212121212121212121212121213|-1yW26.s 1zK06.s 16L0 1iN0 17b0 1jd0 17b0 1ip0 17z0 1i10 17X0 1hB0 18n0 1hd0 19b0 1gp0 19z0 1iN0 17b0 1ip0 17z0 1i10 18n0 1hd0 18L0 1gN0 19b0 1gp0 19z0 1iN0 17z0 1i10 17X0 yGd0",
		"Africa/Khartoum|LMT CAT CAST EAT|-2a.8 -20 -30 -30|012121212121212121212121212121212131|-1yW2a.8 1zK0a.8 16L0 1iN0 17b0 1jd0 17b0 1ip0 17z0 1i10 17X0 1hB0 18n0 1hd0 19b0 1gp0 19z0 1iN0 17b0 1ip0 17z0 1i10 18n0 1hd0 18L0 1gN0 19b0 1gp0 19z0 1iN0 17z0 1i10 17X0 yGd0 HjL0|51e5",
		"Africa/Monrovia|MMT MMT GMT|H.8 I.u 0|012|-23Lzg.Q 28G01.m|11e5",
		"Africa/Ndjamena|LMT WAT WAST|-10.c -10 -20|0121|-2le10.c 2J3c0.c Wn0|13e5",
		"Africa/Tripoli|LMT CET CEST EET|-Q.I -10 -20 -20|012121213121212121212121213123123|-21JcQ.I 1hnBQ.I vx0 4iP0 xx0 4eN0 Bb0 7ip0 U0n0 A10 1db0 1cN0 1db0 1dd0 1db0 1eN0 1bb0 1e10 1cL0 1c10 1db0 1dd0 1db0 1cN0 1db0 1q10 fAn0 1ep0 1db0 AKq0 TA0 1o00|11e5",
		"Africa/Tunis|PMT CET CEST|-9.l -10 -20|0121212121212121212121212121212121|-2nco9.l 18pa9.l 1qM0 DA0 3Tc0 11B0 1ze0 WM0 7z0 3d0 14L0 1cN0 1f90 1ar0 16J0 1gXB0 WM0 1rA0 11c0 nwo0 Ko0 1cM0 1cM0 1rA0 10M0 zuM0 10N0 1aN0 1qM0 WM0 1qM0 11A0 1o00|20e5",
		"Africa/Windhoek|+0130 SAST SAST CAT WAT WAST|-1u -20 -30 -20 -10 -20|01213454545454545454545454545454545454545454545454543|-2GJdu 1Ajdu 1cL0 1SqL0 9Io0 16P0 1nX0 11B0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0|32e4",
		"America/Adak|NST NWT NPT BST BDT AHST HST HDT|b0 a0 a0 b0 a0 a0 a0 90|012034343434343434343434343434343456767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676|-17SX0 8wW0 iB0 Qlb0 52O0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 cm0 10q0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|326",
		"America/Anchorage|AST AWT APT AHST AHDT YST AKST AKDT|a0 90 90 a0 90 90 90 80|012034343434343434343434343434343456767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676|-17T00 8wX0 iA0 Qlb0 52O0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 cm0 10q0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|30e4",
		"America/Port_of_Spain|LMT AST|46.4 40|01|-2kNvR.U|43e3",
		"America/Araguaina|LMT -03 -02|3c.M 30 20|0121212121212121212121212121212121212121212121212121|-2glwL.c HdKL.c 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 1EN0 FX0 1HB0 Lz0 dMN0 Lz0 1zd0 Rb0 1wN0 Wn0 1tB0 Rb0 1tB0 WL0 1tB0 Rb0 1zd0 On0 1HB0 FX0 ny10 Lz0|14e4",
		"America/Argentina/Buenos_Aires|CMT -04 -03 -02|4g.M 40 30 20|01212121212121212121212121212121212121212123232323232323232|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1wp0 Rb0 1wp0 Rb0 1wp0 TX0 A4p0 uL0 1qN0 WL0",
		"America/Argentina/Catamarca|CMT -04 -03 -02|4g.M 40 30 20|01212121212121212121212121212121212121212123232323132321232|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1wp0 Rb0 1wq0 Ra0 1wp0 TX0 rlB0 7B0 8zb0 uL0",
		"America/Argentina/Cordoba|CMT -04 -03 -02|4g.M 40 30 20|01212121212121212121212121212121212121212123232323132323232|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1wp0 Rb0 1wq0 Ra0 1wp0 TX0 A4p0 uL0 1qN0 WL0",
		"America/Argentina/Jujuy|CMT -04 -03 -02|4g.M 40 30 20|012121212121212121212121212121212121212121232323121323232|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1ze0 TX0 1ld0 WK0 1wp0 TX0 A4p0 uL0",
		"America/Argentina/La_Rioja|CMT -04 -03 -02|4g.M 40 30 20|012121212121212121212121212121212121212121232323231232321232|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1wp0 Qn0 qO0 16n0 Rb0 1wp0 TX0 rlB0 7B0 8zb0 uL0",
		"America/Argentina/Mendoza|CMT -04 -03 -02|4g.M 40 30 20|01212121212121212121212121212121212121212123232312121321232|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1u20 SL0 1vd0 Tb0 1wp0 TW0 ri10 Op0 7TX0 uL0",
		"America/Argentina/Rio_Gallegos|CMT -04 -03 -02|4g.M 40 30 20|01212121212121212121212121212121212121212123232323232321232|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1wp0 Rb0 1wp0 Rb0 1wp0 TX0 rlB0 7B0 8zb0 uL0",
		"America/Argentina/Salta|CMT -04 -03 -02|4g.M 40 30 20|012121212121212121212121212121212121212121232323231323232|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1wp0 Rb0 1wq0 Ra0 1wp0 TX0 A4p0 uL0",
		"America/Argentina/San_Juan|CMT -04 -03 -02|4g.M 40 30 20|012121212121212121212121212121212121212121232323231232321232|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1wp0 Qn0 qO0 16n0 Rb0 1wp0 TX0 rld0 m10 8lb0 uL0",
		"America/Argentina/San_Luis|CMT -04 -03 -02|4g.M 40 30 20|012121212121212121212121212121212121212121232323121212321212|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 XX0 1q20 SL0 AN0 vDb0 m10 8lb0 8L0 jd0 1qN0 WL0 1qN0",
		"America/Argentina/Tucuman|CMT -04 -03 -02|4g.M 40 30 20|0121212121212121212121212121212121212121212323232313232123232|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1wp0 Rb0 1wq0 Ra0 1wp0 TX0 rlB0 4N0 8BX0 uL0 1qN0 WL0",
		"America/Argentina/Ushuaia|CMT -04 -03 -02|4g.M 40 30 20|01212121212121212121212121212121212121212123232323232321232|-20UHH.c pKnH.c Mn0 1iN0 Tb0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 1C10 LX0 1C10 LX0 1C10 LX0 1C10 Mn0 MN0 2jz0 MN0 4lX0 u10 5Lb0 1pB0 Fnz0 u10 uL0 1vd0 SL0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 zvd0 Bz0 1tB0 TX0 1wp0 Rb0 1wp0 Rb0 1wp0 TX0 rkN0 8p0 8zb0 uL0",
		"America/Curacao|LMT -0430 AST|4z.L 4u 40|012|-2kV7o.d 28KLS.d|15e4",
		"America/Asuncion|AMT -04 -03|3O.E 40 30|012121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212|-1x589.k 1DKM9.k 3CL0 3Dd0 10L0 1pB0 10n0 1pB0 10n0 1pB0 1cL0 1dd0 1db0 1dd0 1cL0 1dd0 1cL0 1dd0 1cL0 1dd0 1db0 1dd0 1cL0 1dd0 1cL0 1dd0 1cL0 1dd0 1db0 1dd0 1cL0 1lB0 14n0 1dd0 1cL0 1fd0 WL0 1rd0 1aL0 1dB0 Xz0 1qp0 Xb0 1qN0 10L0 1rB0 TX0 1tB0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1qN0 1cL0 WN0 1qL0 11B0 1nX0 1ip0 WL0 1qN0 WL0 1qN0 WL0 1tB0 TX0 1tB0 TX0 1tB0 19X0 1a10 1fz0 1a10 1fz0 1cN0 17b0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1fB0 19X0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1fB0 19X0 1ip0 17b0 1ip0 17b0 1ip0|28e5",
		"America/Atikokan|CST CDT CWT CPT EST|60 50 50 50 50|0101234|-25TQ0 1in0 Rnb0 3je0 8x30 iw0|28e2",
		"America/Bahia|LMT -03 -02|2y.4 30 20|01212121212121212121212121212121212121212121212121212121212121|-2glxp.U HdLp.U 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 1EN0 FX0 1HB0 Lz0 1EN0 Lz0 1C10 IL0 1HB0 Db0 1HB0 On0 1zd0 On0 1zd0 Lz0 1zd0 Rb0 1wN0 Wn0 1tB0 Rb0 1tB0 WL0 1tB0 Rb0 1zd0 On0 1HB0 FX0 l5B0 Rb0|27e5",
		"America/Bahia_Banderas|LMT MST CST PST MDT CDT|71 70 60 80 60 50|0121212131414141414141414141414141414152525252525252525252525252525252525252525252525252525252|-1UQF0 deL0 8lc0 17c0 10M0 1dd0 otX0 gmN0 P2N0 13Vd0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 1fB0 WL0 1fB0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nW0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0|84e3",
		"America/Barbados|LMT BMT AST ADT|3W.t 3W.t 40 30|01232323232|-1Q0I1.v jsM0 1ODC1.v IL0 1ip0 17b0 1ip0 17b0 1ld0 13b0|28e4",
		"America/Belem|LMT -03 -02|3d.U 30 20|012121212121212121212121212121|-2glwK.4 HdKK.4 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0|20e5",
		"America/Belize|LMT CST -0530 CDT|5Q.M 60 5u 50|01212121212121212121212121212121212121212121212121213131|-2kBu7.c fPA7.c Onu 1zcu Rbu 1wou Rbu 1wou Rbu 1zcu Onu 1zcu Onu 1zcu Rbu 1wou Rbu 1wou Rbu 1wou Rbu 1zcu Onu 1zcu Onu 1zcu Rbu 1wou Rbu 1wou Rbu 1zcu Onu 1zcu Onu 1zcu Onu 1zcu Rbu 1wou Rbu 1wou Rbu 1zcu Onu 1zcu Onu 1zcu Rbu 1wou Rbu 1f0Mu qn0 lxB0 mn0|57e3",
		"America/Blanc-Sablon|AST ADT AWT APT|40 30 30 30|010230|-25TS0 1in0 UGp0 8x50 iu0|11e2",
		"America/Boa_Vista|LMT -04 -03|42.E 40 30|0121212121212121212121212121212121|-2glvV.k HdKV.k 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 smp0 WL0 1tB0 2L0|62e2",
		"America/Bogota|BMT -05 -04|4U.g 50 40|0121|-2eb73.I 38yo3.I 2en0|90e5",
		"America/Boise|PST PDT MST MWT MPT MDT|80 70 70 60 60 60|0101023425252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252|-261q0 1nX0 11B0 1nX0 8C10 JCL0 8x20 ix0 QwN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 Dd0 1Kn0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|21e4",
		"America/Cambridge_Bay|-00 MST MWT MPT MDDT MDT CST CDT EST|0 70 60 60 50 60 60 50 50|0123141515151515151515151515151515151515151515678651515151515151515151515151515151515151515151515151515151515151515151515151|-21Jc0 RO90 8x20 ix0 LCL0 1fA0 zgO0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11A0 1nX0 2K0 WQ0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|15e2",
		"America/Campo_Grande|LMT -04 -03|3C.s 40 30|012121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212|-2glwl.w HdLl.w 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 1EN0 FX0 1HB0 Lz0 1EN0 Lz0 1C10 IL0 1HB0 Db0 1HB0 On0 1zd0 On0 1zd0 Lz0 1zd0 Rb0 1wN0 Wn0 1tB0 Rb0 1tB0 WL0 1tB0 Rb0 1zd0 On0 1HB0 FX0 1C10 Lz0 1Ip0 HX0 1zd0 On0 1HB0 IL0 1wp0 On0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 Rb0 1zd0 Lz0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1C10 Lz0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 Rb0 1wp0 On0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1C10 Lz0 1C10 Lz0 1C10 Lz0 1C10 On0 1zd0 Rb0 1wp0 On0 1C10 Lz0 1C10 On0 1zd0|77e4",
		"America/Cancun|LMT CST EST EDT CDT|5L.4 60 50 40 50|0123232341414141414141414141414141414141412|-1UQG0 2q2o0 yLB0 1lb0 14p0 1lb0 14p0 Lz0 xB0 14p0 1nX0 11B0 1nX0 1fB0 WL0 1fB0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 Dd0|63e4",
		"America/Caracas|CMT -0430 -04|4r.E 4u 40|01212|-2kV7w.k 28KM2.k 1IwOu kqo0|29e5",
		"America/Cayenne|LMT -04 -03|3t.k 40 30|012|-2mrwu.E 2gWou.E|58e3",
		"America/Panama|CMT EST|5j.A 50|01|-2uduE.o|15e5",
		"America/Chicago|CST CDT EST CWT CPT|60 50 50 50 50|01010101010101010101010101010101010102010101010103401010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-261s0 1nX0 11B0 1nX0 1wp0 TX0 WN0 1qL0 1cN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 11B0 1Hz0 14p0 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 RB0 8x30 iw0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|92e5",
		"America/Chihuahua|LMT MST CST CDT MDT|74.k 70 60 50 60|0121212323241414141414141414141414141414141414141414141414141414141414141414141414141414141|-1UQF0 deL0 8lc0 17c0 10M0 1dd0 2zQN0 1lb0 14p0 1lb0 14q0 1lb0 14p0 1nX0 11B0 1nX0 1fB0 WL0 1fB0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0|81e4",
		"America/Costa_Rica|SJMT CST CDT|5A.d 60 50|0121212121|-1Xd6n.L 2lu0n.L Db0 1Kp0 Db0 pRB0 15b0 1kp0 mL0|12e5",
		"America/Creston|MST PST|70 80|010|-29DR0 43B0|53e2",
		"America/Cuiaba|LMT -04 -03|3I.k 40 30|0121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212|-2glwf.E HdLf.E 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 1EN0 FX0 1HB0 Lz0 1EN0 Lz0 1C10 IL0 1HB0 Db0 1HB0 On0 1zd0 On0 1zd0 Lz0 1zd0 Rb0 1wN0 Wn0 1tB0 Rb0 1tB0 WL0 1tB0 Rb0 1zd0 On0 1HB0 FX0 4a10 HX0 1zd0 On0 1HB0 IL0 1wp0 On0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 Rb0 1zd0 Lz0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1C10 Lz0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 Rb0 1wp0 On0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1C10 Lz0 1C10 Lz0 1C10 Lz0 1C10 On0 1zd0 Rb0 1wp0 On0 1C10 Lz0 1C10 On0 1zd0|54e4",
		"America/Danmarkshavn|LMT -03 -02 GMT|1e.E 30 20 0|01212121212121212121212121212121213|-2a5WJ.k 2z5fJ.k 19U0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 DC0|8",
		"America/Dawson|YST YDT YWT YPT YDDT PST PDT|90 80 80 80 70 80 70|0101023040565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565|-25TN0 1in0 1o10 13V0 Ser0 8x00 iz0 LCL0 1fA0 jrA0 fNd0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|13e2",
		"America/Dawson_Creek|PST PDT PWT PPT MST|80 70 70 70 70|0102301010101010101010101010101010101010101010101010101014|-25TO0 1in0 UGp0 8x10 iy0 3NB0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 ML0|12e3",
		"America/Denver|MST MDT MWT MPT|70 60 60 60|01010101023010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-261r0 1nX0 11B0 1nX0 11B0 1qL0 WN0 mn0 Ord0 8x20 ix0 LCN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|26e5",
		"America/Detroit|LMT CST EST EWT EPT EDT|5w.b 60 50 40 40 40|012342525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252|-2Cgir.N peqr.N 156L0 8x40 iv0 6fd0 11z0 XQp0 1cL0 s10 1Vz0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|37e5",
		"America/Edmonton|LMT MST MDT MWT MPT|7x.Q 70 60 60 60|01212121212121341212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2yd4q.8 shdq.8 1in0 17d0 hz0 2dB0 1fz0 1a10 11z0 1qN0 WL0 1qN0 11z0 IGN0 8x20 ix0 3NB0 11z0 LFB0 1cL0 3Cp0 1cL0 66N0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|10e5",
		"America/Eirunepe|LMT -05 -04|4D.s 50 40|0121212121212121212121212121212121|-2glvk.w HdLk.w 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 dPB0 On0 yTd0 d5X0|31e3",
		"America/El_Salvador|LMT CST CDT|5U.M 60 50|012121|-1XiG3.c 2Fvc3.c WL0 1qN0 WL0|11e5",
		"America/Tijuana|LMT MST PST PDT PWT PPT|7M.4 70 80 70 70 70|012123245232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232|-1UQE0 4PX0 8mM0 8lc0 SN0 1cL0 pHB0 83r0 zI0 5O10 1Rz0 cOO0 11A0 1o00 11A0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 BUp0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 U10 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|20e5",
		"America/Fort_Nelson|PST PDT PWT PPT MST|80 70 70 70 70|01023010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010104|-25TO0 1in0 UGp0 8x10 iy0 3NB0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0|39e2",
		"America/Fort_Wayne|CST CDT CWT CPT EST EDT|60 50 50 50 50 40|010101023010101010101010101040454545454545454545454545454545454545454545454545454545454545454545454|-261s0 1nX0 11B0 1nX0 QI10 Db0 RB0 8x30 iw0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 5Tz0 1o10 qLb0 1cL0 1cN0 1cL0 1qhd0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/Fortaleza|LMT -03 -02|2y 30 20|0121212121212121212121212121212121212121|-2glxq HdLq 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 1EN0 FX0 1HB0 Lz0 nsp0 WL0 1tB0 5z0 2mN0 On0|34e5",
		"America/Glace_Bay|LMT AST ADT AWT APT|3X.M 40 30 30 30|012134121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2IsI0.c CwO0.c 1in0 UGp0 8x50 iu0 iq10 11z0 Jg10 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|19e3",
		"America/Godthab|LMT -03 -02|3q.U 30 20|0121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2a5Ux.4 2z5dx.4 19U0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|17e3",
		"America/Goose_Bay|NST NDT NST NDT NWT NPT AST ADT ADDT|3u.Q 2u.Q 3u 2u 2u 2u 40 30 20|010232323232323245232323232323232323232323232323232323232326767676767676767676767676767676767676767676768676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676|-25TSt.8 1in0 DXb0 2HbX.8 WL0 1qN0 WL0 1qN0 WL0 1tB0 TX0 1tB0 WL0 1qN0 WL0 1qN0 7UHu itu 1tB0 WL0 1qN0 WL0 1qN0 WL0 1qN0 WL0 1tB0 WL0 1ld0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 S10 g0u 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14n1 1lb0 14p0 1nW0 11C0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zcX Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|76e2",
		"America/Grand_Turk|KMT EST EDT AST|57.b 50 40 40|01212121212121212121212121212121212121212121212121212121212121212121212121232121212121212121212121212121212121212121|-2l1uQ.N 2HHBQ.N 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 5Ip0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|37e2",
		"America/Guatemala|LMT CST CDT|62.4 60 50|0121212121|-24KhV.U 2efXV.U An0 mtd0 Nz0 ifB0 17b0 zDB0 11z0|13e5",
		"America/Guayaquil|QMT -05 -04|5e 50 40|0121|-1yVSK 2uILK rz0|27e5",
		"America/Guyana|LMT -0345 -03 -04|3Q.E 3J 30 40|0123|-2dvU7.k 2r6LQ.k Bxbf|80e4",
		"America/Halifax|LMT AST ADT AWT APT|4e.o 40 30 30 30|0121212121212121212121212121212121212121212121212134121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2IsHJ.A xzzJ.A 1db0 3I30 1in0 3HX0 IL0 1E10 ML0 1yN0 Pb0 1Bd0 Mn0 1Bd0 Rz0 1w10 Xb0 1w10 LX0 1w10 Xb0 1w10 Lz0 1C10 Jz0 1E10 OL0 1yN0 Un0 1qp0 Xb0 1qp0 11X0 1w10 Lz0 1HB0 LX0 1C10 FX0 1w10 Xb0 1qp0 Xb0 1BB0 LX0 1td0 Xb0 1qp0 Xb0 Rf0 8x50 iu0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 3Qp0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 3Qp0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 6i10 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|39e4",
		"America/Havana|HMT CST CDT|5t.A 50 40|012121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-1Meuu.o 72zu.o ML0 sld0 An0 1Nd0 Db0 1Nd0 An0 6Ep0 An0 1Nd0 An0 JDd0 Mn0 1Ap0 On0 1fd0 11X0 1qN0 WL0 1wp0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 14n0 1ld0 14L0 1kN0 15b0 1kp0 1cL0 1cN0 1fz0 1a10 1fz0 1fB0 11z0 14p0 1nX0 11B0 1nX0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 14n0 1ld0 14n0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 1a10 1in0 1a10 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 17c0 1o00 11A0 1qM0 11A0 1o00 11A0 1o00 14o0 1lc0 14o0 1lc0 11A0 6i00 Rc0 1wo0 U00 1tA0 Rc0 1wo0 U00 1wo0 U00 1zc0 U00 1qM0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0|21e5",
		"America/Hermosillo|LMT MST CST PST MDT|7n.Q 70 60 80 60|0121212131414141|-1UQF0 deL0 8lc0 17c0 10M0 1dd0 otX0 gmN0 P2N0 13Vd0 1lb0 14p0 1lb0 14p0 1lb0|64e4",
		"America/Indiana/Knox|CST CDT CWT CPT EST|60 50 50 50 50|0101023010101010101010101010101010101040101010101010101010101010101010101010101010101010141010101010101010101010101010101010101010101010101010101010101010|-261s0 1nX0 11B0 1nX0 SgN0 8x30 iw0 3NB0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 1fz0 1cN0 1cL0 1cN0 11z0 1o10 11z0 1o10 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 3Cn0 8wp0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 z8o0 1o00 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/Indiana/Marengo|CST CDT CWT CPT EST EDT|60 50 50 50 50 40|0101023010101010101010104545454545414545454545454545454545454545454545454545454545454545454545454545454|-261s0 1nX0 11B0 1nX0 SgN0 8x30 iw0 dyN0 11z0 6fd0 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 jrz0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1VA0 LA0 1BX0 1e6p0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/Indiana/Petersburg|CST CDT CWT CPT EST EDT|60 50 50 50 50 40|01010230101010101010101010104010101010101010101010141014545454545454545454545454545454545454545454545454545454545454|-261s0 1nX0 11B0 1nX0 SgN0 8x30 iw0 njX0 WN0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 3Fb0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 19co0 1o00 Rd0 1zb0 Oo0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/Indiana/Tell_City|CST CDT CWT CPT EST EDT|60 50 50 50 50 40|01010230101010101010101010101010454541010101010101010101010101010101010101010101010101010101010101010|-261s0 1nX0 11B0 1nX0 SgN0 8x30 iw0 1o10 11z0 g0p0 11z0 1o10 11z0 1qL0 WN0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 1fz0 1cN0 WL0 1qN0 1cL0 1cN0 1cL0 1cN0 caL0 1cL0 1cN0 1cL0 1qhd0 1o00 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/Indiana/Vevay|CST CDT CWT CPT EST EDT|60 50 50 50 50 40|010102304545454545454545454545454545454545454545454545454545454545454545454545454|-261s0 1nX0 11B0 1nX0 SgN0 8x30 iw0 kPB0 Awn0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1lnd0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/Indiana/Vincennes|CST CDT CWT CPT EST EDT|60 50 50 50 50 40|01010230101010101010101010101010454541014545454545454545454545454545454545454545454545454545454545454|-261s0 1nX0 11B0 1nX0 SgN0 8x30 iw0 1o10 11z0 g0p0 11z0 1o10 11z0 1qL0 WN0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 1fz0 1cN0 WL0 1qN0 1cL0 1cN0 1cL0 1cN0 caL0 1cL0 1cN0 1cL0 1qhd0 1o00 Rd0 1zb0 Oo0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/Indiana/Winamac|CST CDT CWT CPT EST EDT|60 50 50 50 50 40|01010230101010101010101010101010101010454541054545454545454545454545454545454545454545454545454545454545454|-261s0 1nX0 11B0 1nX0 SgN0 8x30 iw0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 1fz0 1cN0 1cL0 1cN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 jrz0 1cL0 1cN0 1cL0 1qhd0 1o00 Rd0 1za0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/Inuvik|-00 PST PDDT MST MDT|0 80 60 70 60|0121343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343|-FnA0 tWU0 1fA0 wPe0 2pz0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|35e2",
		"America/Iqaluit|-00 EWT EPT EST EDDT EDT CST CDT|0 40 40 50 30 40 60 50|01234353535353535353535353535353535353535353567353535353535353535353535353535353535353535353535353535353535353535353535353|-16K00 7nX0 iv0 LCL0 1fA0 zgO0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11C0 1nX0 11A0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|67e2",
		"America/Jamaica|KMT EST EDT|57.b 50 40|0121212121212121212121|-2l1uQ.N 2uM1Q.N 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0|94e4",
		"America/Juneau|PST PWT PPT PDT YDT YST AKST AKDT|80 70 70 70 80 90 90 80|01203030303030303030303030403030356767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676|-17T20 8x10 iy0 Vo10 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cM0 1cM0 1cL0 1cN0 1fz0 1a10 1fz0 co0 10q0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|33e3",
		"America/Kentucky/Louisville|CST CDT CWT CPT EST EDT|60 50 50 50 50 40|0101010102301010101010101010101010101454545454545414545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454|-261s0 1nX0 11B0 1nX0 3Fd0 Nb0 LPd0 11z0 RB0 8x30 iw0 Bb0 10N0 2bB0 8in0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 xz0 gso0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1VA0 LA0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/Kentucky/Monticello|CST CDT CWT CPT EST EDT|60 50 50 50 50 40|0101023010101010101010101010101010101010101010101010101010101010101010101454545454545454545454545454545454545454545454545454545454545454545454545454|-261s0 1nX0 11B0 1nX0 SgN0 8x30 iw0 SWp0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11A0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/La_Paz|CMT BOST -04|4w.A 3w.A 40|012|-1x37r.o 13b0|19e5",
		"America/Lima|LMT -05 -04|58.A 50 40|0121212121212121|-2tyGP.o 1bDzP.o zX0 1aN0 1cL0 1cN0 1cL0 1PrB0 zX0 1O10 zX0 6Gp0 zX0 98p0 zX0|11e6",
		"America/Los_Angeles|PST PDT PWT PPT|80 70 70 70|010102301010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-261q0 1nX0 11B0 1nX0 SgN0 8x10 iy0 5Wp1 1VaX 3dA0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1a00 1fA0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|15e6",
		"America/Maceio|LMT -03 -02|2m.Q 30 20|012121212121212121212121212121212121212121|-2glxB.8 HdLB.8 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 1EN0 FX0 1HB0 Lz0 dMN0 Lz0 8Q10 WL0 1tB0 5z0 2mN0 On0|93e4",
		"America/Managua|MMT CST EST CDT|5J.c 60 50 50|0121313121213131|-1quie.M 1yAMe.M 4mn0 9Up0 Dz0 1K10 Dz0 s3F0 1KH0 DB0 9In0 k8p0 19X0 1o30 11y0|22e5",
		"America/Manaus|LMT -04 -03|40.4 40 30|01212121212121212121212121212121|-2glvX.U HdKX.U 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 dPB0 On0|19e5",
		"America/Martinique|FFMT AST ADT|44.k 40 30|0121|-2mPTT.E 2LPbT.E 19X0|39e4",
		"America/Matamoros|LMT CST CDT|6E 60 50|0121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-1UQG0 2FjC0 1nX0 i6p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 1fB0 WL0 1fB0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 U10 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|45e4",
		"America/Mazatlan|LMT MST CST PST MDT|75.E 70 60 80 60|0121212131414141414141414141414141414141414141414141414141414141414141414141414141414141414141|-1UQF0 deL0 8lc0 17c0 10M0 1dd0 otX0 gmN0 P2N0 13Vd0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 1fB0 WL0 1fB0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0|44e4",
		"America/Menominee|CST CDT CWT CPT EST|60 50 50 50 50|01010230101041010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-261s0 1nX0 11B0 1nX0 SgN0 8x30 iw0 1o10 11z0 LCN0 1fz0 6410 9Jb0 1cM0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|85e2",
		"America/Merida|LMT CST EST CDT|5W.s 60 50 50|0121313131313131313131313131313131313131313131313131313131313131313131313131313131313131|-1UQG0 2q2o0 2hz0 wu30 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 1fB0 WL0 1fB0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0|11e5",
		"America/Metlakatla|PST PWT PPT PDT AKST AKDT|80 70 70 70 90 80|0120303030303030303030303030303030454545454545454545454545454545454545454545454|-17T20 8x10 iy0 Vo10 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1hU10 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|14e2",
		"America/Mexico_City|LMT MST CST CDT CWT|6A.A 70 60 50 50|012121232324232323232323232323232323232323232323232323232323232323232323232323232323232323232323232|-1UQF0 deL0 8lc0 17c0 10M0 1dd0 gEn0 TX0 3xd0 Jb0 6zB0 SL0 e5d0 17b0 1Pff0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 1fB0 WL0 1fB0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0|20e6",
		"America/Miquelon|LMT AST -03 -02|3I.E 40 30 20|012323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232|-2mKkf.k 2LTAf.k gQ10 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|61e2",
		"America/Moncton|EST AST ADT AWT APT|50 40 30 30 30|012121212121212121212134121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2IsH0 CwN0 1in0 zAo0 An0 1Nd0 An0 1Nd0 An0 1Nd0 An0 1Nd0 An0 1Nd0 An0 1K10 Lz0 1zB0 NX0 1u10 Wn0 S20 8x50 iu0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 3Cp0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14n1 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 ReX 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|64e3",
		"America/Monterrey|LMT CST CDT|6F.g 60 50|0121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-1UQG0 2FjC0 1nX0 i6p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 1fB0 WL0 1fB0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0|41e5",
		"America/Montevideo|MMT -0330 -03 -02 -0230|3I.I 3u 30 20 2u|012121212121212121212121213232323232324242423243232323232323232323232323232323232323232|-20UIf.g 8jzJ.g 1cLu 1dcu 1cLu 1dcu 1cLu ircu 11zu 1o0u 11zu 1o0u 11zu 1qMu WLu 1qMu WLu 1qMu WLu 1qMu 11zu 1o0u 11zu NAu 11bu 2iMu zWu Dq10 19X0 pd0 jz0 cm10 19X0 1fB0 1on0 11d0 1oL0 1nB0 1fzu 1aou 1fzu 1aou 1fzu 3nAu Jb0 3MN0 1SLu 4jzu 2PB0 Lb0 3Dd0 1pb0 ixd0 An0 1MN0 An0 1wp0 On0 1wp0 Rb0 1zd0 On0 1wp0 Rb0 s8p0 1fB0 1ip0 11z0 1ld0 14n0 1o10 11z0 1o10 11z0 1o10 14n0 1ld0 14n0 1ld0 14n0 1o10 11z0 1o10 11z0 1o10 11z0|17e5",
		"America/Toronto|EST EDT EWT EPT|50 40 40 40|01010101010101010101010101010101010101010101012301010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-25TR0 1in0 11Wu 1nzu 1fD0 WJ0 1wr0 Nb0 1Ap0 On0 1zd0 On0 1wp0 TX0 1tB0 TX0 1tB0 TX0 1tB0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 4kM0 8x40 iv0 1o10 11z0 1nX0 11z0 1o10 11z0 1o10 1qL0 11D0 1nX0 11B0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|65e5",
		"America/Nassau|LMT EST EDT|59.u 50 40|012121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2kNuO.u 26XdO.u 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|24e4",
		"America/New_York|EST EDT EWT EPT|50 40 40 40|01010101010101010101010101010101010101010101010102301010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-261t0 1nX0 11B0 1nX0 11B0 1qL0 1a10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 RB0 8x40 iv0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|21e6",
		"America/Nipigon|EST EDT EWT EPT|50 40 40 40|010123010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-25TR0 1in0 Rnb0 3je0 8x40 iv0 19yN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|16e2",
		"America/Nome|NST NWT NPT BST BDT YST AKST AKDT|b0 a0 a0 b0 a0 90 90 80|012034343434343434343434343434343456767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676767676|-17SX0 8wW0 iB0 Qlb0 52O0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 cl0 10q0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|38e2",
		"America/Noronha|LMT -02 -01|29.E 20 10|0121212121212121212121212121212121212121|-2glxO.k HdKO.k 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 1EN0 FX0 1HB0 Lz0 nsp0 WL0 1tB0 2L0 2pB0 On0|30e2",
		"America/North_Dakota/Beulah|MST MDT MWT MPT CST CDT|70 60 60 60 60 50|010102301010101010101010101010101010101010101010101010101010101010101010101010101010101010101014545454545454545454545454545454545454545454545454545454|-261r0 1nX0 11B0 1nX0 SgN0 8x20 ix0 QwN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Oo0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/North_Dakota/Center|MST MDT MWT MPT CST CDT|70 60 60 60 60 50|010102301010101010101010101010101010101010101010101010101014545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454|-261r0 1nX0 11B0 1nX0 SgN0 8x20 ix0 QwN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14o0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/North_Dakota/New_Salem|MST MDT MWT MPT CST CDT|70 60 60 60 60 50|010102301010101010101010101010101010101010101010101010101010101010101010101010101454545454545454545454545454545454545454545454545454545454545454545454|-261r0 1nX0 11B0 1nX0 SgN0 8x20 ix0 QwN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14o0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"America/Ojinaga|LMT MST CST CDT MDT|6V.E 70 60 50 60|0121212323241414141414141414141414141414141414141414141414141414141414141414141414141414141|-1UQF0 deL0 8lc0 17c0 10M0 1dd0 2zQN0 1lb0 14p0 1lb0 14q0 1lb0 14p0 1nX0 11B0 1nX0 1fB0 WL0 1fB0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 U10 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|23e3",
		"America/Pangnirtung|-00 AST AWT APT ADDT ADT EDT EST CST CDT|0 40 30 30 20 30 40 50 60 50|012314151515151515151515151515151515167676767689767676767676767676767676767676767676767676767676767676767676767676767676767|-1XiM0 PnG0 8x50 iu0 LCL0 1fA0 zgO0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1o00 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11C0 1nX0 11A0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|14e2",
		"America/Paramaribo|LMT PMT PMT -0330 -03|3E.E 3E.Q 3E.A 3u 30|01234|-2nDUj.k Wqo0.c qanX.I 1yVXN.o|24e4",
		"America/Phoenix|MST MDT MWT|70 60 60|01010202010|-261r0 1nX0 11B0 1nX0 SgN0 4Al1 Ap0 1db0 SWqX 1cL0|42e5",
		"America/Port-au-Prince|PPMT EST EDT|4N 50 40|01212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-28RHb 2FnMb 19X0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14q0 1o00 11A0 1o00 11A0 1o00 14o0 1lc0 14o0 1lc0 14o0 1o00 11A0 1o00 11A0 1o00 14o0 1lc0 14o0 1lc0 i6n0 1nX0 11B0 1nX0 d430 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 3iN0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|23e5",
		"America/Rio_Branco|LMT -05 -04|4v.c 50 40|01212121212121212121212121212121|-2glvs.M HdLs.M 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 NBd0 d5X0|31e4",
		"America/Porto_Velho|LMT -04 -03|4f.A 40 30|012121212121212121212121212121|-2glvI.o HdKI.o 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0|37e4",
		"America/Puerto_Rico|AST AWT APT|40 30 30|0120|-17lU0 7XT0 iu0|24e5",
		"America/Punta_Arenas|SMT -05 -04 -03|4G.K 50 40 30|0102021212121212121232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323|-2q2jh.e fJAh.e 5knG.K 1Vzh.e jRAG.K 1pbh.e 11d0 1oL0 11d0 1oL0 11d0 1oL0 11d0 1pb0 11d0 nHX0 op0 blz0 ko0 Qeo0 WL0 1zd0 On0 1ip0 11z0 1o10 11z0 1qN0 WL0 1ld0 14n0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 WL0 1qN0 1cL0 1cN0 11z0 1o10 11z0 1qN0 WL0 1fB0 19X0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 17b0 1ip0 11z0 1ip0 1fz0 1fB0 11z0 1qN0 WL0 1qN0 WL0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 17b0 1ip0 11z0 1o10 19X0 1fB0 1nX0 G10 1EL0 Op0 1zb0 Rd0 1wn0 Rd0 46n0 Ap0",
		"America/Rainy_River|CST CDT CWT CPT|60 50 50 50|010123010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-25TQ0 1in0 Rnb0 3je0 8x30 iw0 19yN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|842",
		"America/Rankin_Inlet|-00 CST CDDT CDT EST|0 60 40 50 50|012131313131313131313131313131313131313131313431313131313131313131313131313131313131313131313131313131313131313131313131|-vDc0 keu0 1fA0 zgO0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|26e2",
		"America/Recife|LMT -03 -02|2j.A 30 20|0121212121212121212121212121212121212121|-2glxE.o HdLE.o 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 1EN0 FX0 1HB0 Lz0 nsp0 WL0 1tB0 2L0 2pB0 On0|33e5",
		"America/Regina|LMT MST MDT MWT MPT CST|6W.A 70 60 60 60 60|012121212121212121212121341212121212121212121212121215|-2AD51.o uHe1.o 1in0 s2L0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 66N0 1cL0 1cN0 19X0 1fB0 1cL0 1fB0 1cL0 1cN0 1cL0 M30 8x20 ix0 1ip0 1cL0 1ip0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 3NB0 1cL0 1cN0|19e4",
		"America/Resolute|-00 CST CDDT CDT EST|0 60 40 50 50|012131313131313131313131313131313131313131313431313131313431313131313131313131313131313131313131313131313131313131313131|-SnA0 GWS0 1fA0 zgO0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|229",
		"America/Santarem|LMT -04 -03|3C.M 40 30|0121212121212121212121212121212|-2glwl.c HdLl.c 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 qe10 xb0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 NBd0|21e4",
		"America/Santiago|SMT -05 -04 -03|4G.K 50 40 30|010202121212121212321232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323|-2q2jh.e fJAh.e 5knG.K 1Vzh.e jRAG.K 1pbh.e 11d0 1oL0 11d0 1oL0 11d0 1oL0 11d0 1pb0 11d0 nHX0 op0 9Bz0 jb0 1oN0 ko0 Qeo0 WL0 1zd0 On0 1ip0 11z0 1o10 11z0 1qN0 WL0 1ld0 14n0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 WL0 1qN0 1cL0 1cN0 11z0 1o10 11z0 1qN0 WL0 1fB0 19X0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 17b0 1ip0 11z0 1ip0 1fz0 1fB0 11z0 1qN0 WL0 1qN0 WL0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 17b0 1ip0 11z0 1o10 19X0 1fB0 1nX0 G10 1EL0 Op0 1zb0 Rd0 1wn0 Rd0 46n0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Dd0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Dd0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Dd0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0|62e5",
		"America/Santo_Domingo|SDMT EST EDT -0430 AST|4E 50 40 4u 40|01213131313131414|-1ttjk 1lJMk Mn0 6sp0 Lbu 1Cou yLu 1RAu wLu 1QMu xzu 1Q0u xXu 1PAu 13jB0 e00|29e5",
		"America/Sao_Paulo|LMT -03 -02|36.s 30 20|012121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212|-2glwR.w HdKR.w 1cc0 1e10 1bX0 Ezd0 So0 1vA0 Mn0 1BB0 ML0 1BB0 zX0 pTd0 PX0 2ep0 nz0 1C10 zX0 1C10 LX0 1C10 Mn0 H210 Rb0 1tB0 IL0 1Fd0 FX0 1EN0 FX0 1HB0 Lz0 1EN0 Lz0 1C10 IL0 1HB0 Db0 1HB0 On0 1zd0 On0 1zd0 Lz0 1zd0 Rb0 1wN0 Wn0 1tB0 Rb0 1tB0 WL0 1tB0 Rb0 1zd0 On0 1HB0 FX0 1C10 Lz0 1Ip0 HX0 1zd0 On0 1HB0 IL0 1wp0 On0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 Rb0 1zd0 Lz0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1C10 Lz0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 Rb0 1wp0 On0 1C10 Lz0 1C10 On0 1zd0 On0 1zd0 On0 1zd0 On0 1C10 Lz0 1C10 Lz0 1C10 Lz0 1C10 On0 1zd0 Rb0 1wp0 On0 1C10 Lz0 1C10 On0 1zd0|20e6",
		"America/Scoresbysund|LMT -02 -01 +00|1r.Q 20 10 0|0121323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232|-2a5Ww.8 2z5ew.8 1a00 1cK0 1cL0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|452",
		"America/Sitka|PST PWT PPT PDT YST AKST AKDT|80 70 70 70 90 90 80|01203030303030303030303030303030345656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565|-17T20 8x10 iy0 Vo10 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 co0 10q0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|90e2",
		"America/St_Johns|NST NDT NST NDT NWT NPT NDDT|3u.Q 2u.Q 3u 2u 2u 2u 1u|01010101010101010101010101010101010102323232323232324523232323232323232323232323232323232323232323232323232323232323232323232323232323232326232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232|-28oit.8 14L0 1nB0 1in0 1gm0 Dz0 1JB0 1cL0 1cN0 1cL0 1fB0 19X0 1fB0 19X0 1fB0 19X0 1fB0 19X0 1fB0 1cL0 1cN0 1cL0 1fB0 19X0 1fB0 19X0 1fB0 19X0 1fB0 19X0 1fB0 1cL0 1fB0 19X0 1fB0 19X0 10O0 eKX.8 19X0 1iq0 WL0 1qN0 WL0 1qN0 WL0 1tB0 TX0 1tB0 WL0 1qN0 WL0 1qN0 7UHu itu 1tB0 WL0 1qN0 WL0 1qN0 WL0 1qN0 WL0 1tB0 WL0 1ld0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14n1 1lb0 14p0 1nW0 11C0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zcX Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|11e4",
		"America/Swift_Current|LMT MST MDT MWT MPT CST|7b.k 70 60 60 60 60|012134121212121212121215|-2AD4M.E uHdM.E 1in0 UGp0 8x20 ix0 1o10 17b0 1ip0 11z0 1o10 11z0 1o10 11z0 isN0 1cL0 3Cp0 1cL0 1cN0 11z0 1qN0 WL0 pMp0|16e3",
		"America/Tegucigalpa|LMT CST CDT|5M.Q 60 50|01212121|-1WGGb.8 2ETcb.8 WL0 1qN0 WL0 GRd0 AL0|11e5",
		"America/Thule|LMT AST ADT|4z.8 40 30|012121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2a5To.Q 31NBo.Q 1cL0 1cN0 1cL0 1fB0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|656",
		"America/Thunder_Bay|CST EST EWT EPT EDT|60 50 40 40 40|0123141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141|-2q5S0 1iaN0 8x40 iv0 XNB0 1cL0 1cN0 1fz0 1cN0 1cL0 3Cp0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|11e4",
		"America/Vancouver|PST PDT PWT PPT|80 70 70 70|0102301010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-25TO0 1in0 UGp0 8x10 iy0 1o10 17b0 1ip0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|23e5",
		"America/Whitehorse|YST YDT YWT YPT YDDT PST PDT|90 80 80 80 70 80 70|0101023040565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565656565|-25TN0 1in0 1o10 13V0 Ser0 8x00 iz0 LCL0 1fA0 3NA0 vrd0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|23e3",
		"America/Winnipeg|CST CDT CWT CPT|60 50 50 50|010101023010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2aIi0 WL0 3ND0 1in0 Jap0 Rb0 aCN0 8x30 iw0 1tB0 11z0 1ip0 11z0 1o10 11z0 1o10 11z0 1rd0 10L0 1op0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 1cL0 1cN0 11z0 6i10 WL0 6i10 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1a00 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1a00 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 14o0 1lc0 14o0 1o00 11A0 1o00 11A0 1o00 14o0 1lc0 14o0 1lc0 14o0 1o00 11A0 1o00 11A0 1o00 14o0 1lc0 14o0 1lc0 14o0 1lc0 14o0 1o00 11A0 1o00 11A0 1o00 14o0 1lc0 14o0 1lc0 14o0 1o00 11A0 1o00 11A0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|66e4",
		"America/Yakutat|YST YWT YPT YDT AKST AKDT|90 80 80 80 90 80|01203030303030303030303030303030304545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454|-17T10 8x00 iz0 Vo10 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 cn0 10q0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|642",
		"America/Yellowknife|-00 MST MWT MPT MDDT MDT|0 70 60 60 50 60|012314151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151|-1pdA0 hix0 8x20 ix0 LCL0 1fA0 zgO0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|19e3",
		"Antarctica/Casey|-00 +08 +11|0 -80 -b0|0121212|-2q00 1DjS0 T90 40P0 KL0 blz0|10",
		"Antarctica/Davis|-00 +07 +05|0 -70 -50|01012121|-vyo0 iXt0 alj0 1D7v0 VB0 3Wn0 KN0|70",
		"Antarctica/DumontDUrville|-00 +10|0 -a0|0101|-U0o0 cfq0 bFm0|80",
		"Antarctica/Macquarie|AEST AEDT -00 +11|-a0 -b0 0 -b0|0102010101010101010101010101010101010101010101010101010101010101010101010101010101010101013|-29E80 19X0 4SL0 1ayy0 Lvs0 1cM0 1o00 Rc0 1wo0 Rc0 1wo0 U00 1wo0 LA0 1C00 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 11A0 1qM0 WM0 1qM0 Oo0 1zc0 Oo0 1zc0 Oo0 1wo0 WM0 1tA0 WM0 1tA0 U00 1tA0 U00 1tA0 11A0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 11A0 1o00 1io0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1cM0 1a00 1io0 1cM0 1cM0 1cM0 1cM0 1cM0|1",
		"Antarctica/Mawson|-00 +06 +05|0 -60 -50|012|-CEo0 2fyk0|60",
		"Pacific/Auckland|NZMT NZST NZST NZDT|-bu -cu -c0 -d0|01020202020202020202020202023232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323|-1GCVu Lz0 1tB0 11zu 1o0u 11zu 1o0u 11zu 1o0u 14nu 1lcu 14nu 1lcu 1lbu 11Au 1nXu 11Au 1nXu 11Au 1nXu 11Au 1nXu 11Au 1qLu WMu 1qLu 11Au 1n1bu IM0 1C00 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1qM0 14o0 1lc0 14o0 1lc0 14o0 1lc0 17c0 1io0 17c0 1io0 17c0 1io0 17c0 1lc0 14o0 1lc0 14o0 1lc0 17c0 1io0 17c0 1io0 17c0 1lc0 14o0 1lc0 14o0 1lc0 17c0 1io0 17c0 1io0 17c0 1io0 17c0 1io0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00|14e5",
		"Antarctica/Palmer|-00 -03 -04 -02|0 30 40 20|0121212121213121212121212121212121212121212121212121212121212121212121212121212121|-cao0 nD0 1vd0 SL0 1vd0 17z0 1cN0 1fz0 1cN0 1cL0 1cN0 asn0 Db0 jsN0 14N0 11z0 1o10 11z0 1qN0 WL0 1qN0 WL0 1qN0 1cL0 1cN0 11z0 1o10 11z0 1qN0 WL0 1fB0 19X0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 17b0 1ip0 11z0 1ip0 1fz0 1fB0 11z0 1qN0 WL0 1qN0 WL0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 17b0 1ip0 11z0 1o10 19X0 1fB0 1nX0 G10 1EL0 Op0 1zb0 Rd0 1wn0 Rd0 46n0 Ap0|40",
		"Antarctica/Rothera|-00 -03|0 30|01|gOo0|130",
		"Antarctica/Syowa|-00 +03|0 -30|01|-vs00|20",
		"Antarctica/Troll|-00 +00 +02|0 0 -20|01212121212121212121212121212121212121212121212121212121212121212121|1puo0 hd0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|40",
		"Antarctica/Vostok|-00 +06|0 -60|01|-tjA0|25",
		"Europe/Oslo|CET CEST|-10 -20|010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2awM0 Qm0 W6o0 5pf0 WM0 1fA0 1cM0 1cM0 1cM0 1cM0 wJc0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1qM0 WM0 zpc0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|62e4",
		"Asia/Riyadh|LMT +03|-36.Q -30|01|-TvD6.Q|57e5",
		"Asia/Almaty|LMT +05 +06 +07|-57.M -50 -60 -70|012323232323232323232321232323232323232323232323232|-1Pc57.M eUo7.M 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0|15e5",
		"Asia/Amman|LMT EET EEST|-2n.I -20 -30|0121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-1yW2n.I 1HiMn.I KL0 1oN0 11b0 1oN0 11b0 1pd0 1dz0 1cp0 11b0 1op0 11b0 fO10 1db0 1e10 1cL0 1cN0 1cL0 1cN0 1fz0 1pd0 10n0 1ld0 14n0 1hB0 15b0 1ip0 19X0 1cN0 1cL0 1cN0 17b0 1ld0 14o0 1lc0 17c0 1io0 17c0 1io0 17c0 1So0 y00 1fc0 1dc0 1co0 1dc0 1cM0 1cM0 1cM0 1o00 11A0 1lc0 17c0 1cM0 1cM0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 4bX0 Dd0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0|25e5",
		"Asia/Anadyr|LMT +12 +13 +14 +11|-bN.U -c0 -d0 -e0 -b0|01232121212121212121214121212121212121212121212121212121212141|-1PcbN.U eUnN.U 23CL0 1db0 2q10 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 2sp0 WM0|13e3",
		"Asia/Aqtau|LMT +04 +05 +06|-3l.4 -40 -50 -60|012323232323232323232123232312121212121212121212|-1Pc3l.4 eUnl.4 24PX0 2pX0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cN0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0|15e4",
		"Asia/Aqtobe|LMT +04 +05 +06|-3M.E -40 -50 -60|0123232323232323232321232323232323232323232323232|-1Pc3M.E eUnM.E 23CL0 3Db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0|27e4",
		"Asia/Ashgabat|LMT +04 +05 +06|-3R.w -40 -50 -60|0123232323232323232323212|-1Pc3R.w eUnR.w 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0|41e4",
		"Asia/Atyrau|LMT +03 +05 +06 +04|-3r.I -30 -50 -60 -40|01232323232323232323242323232323232324242424242|-1Pc3r.I eUor.I 24PW0 2pX0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 2sp0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0",
		"Asia/Baghdad|BMT +03 +04|-2V.A -30 -40|012121212121212121212121212121212121212121212121212121|-26BeV.A 2ACnV.A 11b0 1cp0 1dz0 1dd0 1db0 1cN0 1cp0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1de0 1dc0 1dc0 1dc0 1cM0 1dc0 1cM0 1dc0 1cM0 1dc0 1dc0 1dc0 1cM0 1dc0 1cM0 1dc0 1cM0 1dc0 1dc0 1dc0 1cM0 1dc0 1cM0 1dc0 1cM0 1dc0 1dc0 1dc0 1cM0 1dc0 1cM0 1dc0 1cM0 1dc0|66e5",
		"Asia/Qatar|LMT +04 +03|-3q.8 -40 -30|012|-21Jfq.8 27BXq.8|96e4",
		"Asia/Baku|LMT +03 +04 +05|-3j.o -30 -40 -50|01232323232323232323232123232323232323232323232323232323232323232|-1Pc3j.o 1jUoj.o WCL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 1cM0 9Je0 1o00 11z0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00|27e5",
		"Asia/Bangkok|BMT +07|-6G.4 -70|01|-218SG.4|15e6",
		"Asia/Barnaul|LMT +06 +07 +08|-5z -60 -70 -80|0123232323232323232323212323232321212121212121212121212121212121212|-21S5z pCnz 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 p90 LE0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0 3rd0",
		"Asia/Beirut|EET EEST|-20 -30|010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-21aq0 1on0 1410 1db0 19B0 1in0 1ip0 WL0 1lQp0 11b0 1oN0 11b0 1oN0 11b0 1pd0 11b0 1oN0 11b0 q6N0 En0 1oN0 11b0 1oN0 11b0 1oN0 11b0 1pd0 11b0 1oN0 11b0 1op0 11b0 dA10 17b0 1iN0 17b0 1iN0 17b0 1iN0 17b0 1vB0 SL0 1mp0 13z0 1iN0 17b0 1iN0 17b0 1jd0 12n0 1a10 1cL0 1cN0 1cL0 1cN0 1cL0 1fB0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0|22e5",
		"Asia/Bishkek|LMT +05 +06 +07|-4W.o -50 -60 -70|012323232323232323232321212121212121212121212121212|-1Pc4W.o eUnW.o 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2e00 1tX0 17b0 1ip0 17b0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1cPu 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0|87e4",
		"Asia/Brunei|LMT +0730 +08|-7D.E -7u -80|012|-1KITD.E gDc9.E|42e4",
		"Asia/Kolkata|MMT IST +0630|-5l.a -5u -6u|012121|-2zOtl.a 1r2LP.a 1un0 HB0 7zX0|15e6",
		"Asia/Chita|LMT +08 +09 +10|-7x.Q -80 -90 -a0|012323232323232323232321232323232323232323232323232323232323232312|-21Q7x.Q pAnx.Q 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0 3re0|33e4",
		"Asia/Choibalsan|LMT +07 +08 +10 +09|-7C -70 -80 -a0 -90|0123434343434343434343434343434343434343434343424242|-2APHC 2UkoC cKn0 1da0 1dd0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1fB0 1cL0 1cN0 1cL0 1cN0 1cL0 6hD0 11z0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 3Db0 h1f0 1cJ0 1cP0 1cJ0|38e3",
		"Asia/Shanghai|CST CDT|-80 -90|01010101010101010|-1c1I0 LX0 16p0 1jz0 1Myp0 Rb0 1o10 11z0 1o10 11z0 1qN0 11z0 1o10 11z0 1o10 11z0|23e6",
		"Asia/Colombo|MMT +0530 +06 +0630|-5j.w -5u -60 -6u|01231321|-2zOtj.w 1rFbN.w 1zzu 7Apu 23dz0 11zu n3cu|22e5",
		"Asia/Dhaka|HMT +0630 +0530 +06 +07|-5R.k -6u -5u -60 -70|0121343|-18LFR.k 1unn.k HB0 m6n0 2kxbu 1i00|16e6",
		"Asia/Damascus|LMT EET EEST|-2p.c -20 -30|01212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-21Jep.c Hep.c 17b0 1ip0 17b0 1ip0 17b0 1ip0 19X0 1xRB0 11X0 1oN0 10L0 1pB0 11b0 1oN0 10L0 1mp0 13X0 1oN0 11b0 1pd0 11b0 1oN0 11b0 1oN0 11b0 1oN0 11b0 1pd0 11b0 1oN0 11b0 1oN0 11b0 1oN0 11b0 1pd0 11b0 1oN0 Nb0 1AN0 Nb0 bcp0 19X0 1gp0 19X0 3ld0 1xX0 Vd0 1Bz0 Sp0 1vX0 10p0 1dz0 1cN0 1cL0 1db0 1db0 1g10 1an0 1ap0 1db0 1fd0 1db0 1cN0 1db0 1dd0 1db0 1cp0 1dz0 1c10 1dX0 1cN0 1db0 1dd0 1db0 1cN0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1db0 1cN0 1db0 1cN0 19z0 1fB0 1qL0 11B0 1on0 Wp0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0|26e5",
		"Asia/Dili|LMT +08 +09|-8m.k -80 -90|01212|-2le8m.k 1dnXm.k 1nfA0 Xld0|19e4",
		"Asia/Dubai|LMT +04|-3F.c -40|01|-21JfF.c|39e5",
		"Asia/Dushanbe|LMT +05 +06 +07|-4z.c -50 -60 -70|012323232323232323232321|-1Pc4z.c eUnz.c 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2hB0|76e4",
		"Asia/Famagusta|LMT EET EEST +03|-2f.M -20 -30 -30|0121212121212121212121212121212121212121212121212121212121212121212121212121212121212312121212121212121212121212121212121212121|-1Vc2f.M 2a3cf.M 1cL0 1qp0 Xz0 19B0 19X0 1fB0 1db0 1cp0 1cL0 1fB0 19X0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1fB0 1cL0 1cN0 1cL0 1cN0 1o30 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 15U0 2Ks0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00",
		"Asia/Gaza|EET EEST IST IDT|-20 -30 -20 -30|010101010101010101010101010101012323232323232323232323232320101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-1c2q0 5Rb0 10r0 1px0 10N0 1pz0 16p0 1jB0 16p0 1jx0 pBd0 Vz0 1oN0 11b0 1oO0 10N0 1pz0 10N0 1pb0 10N0 1pb0 10N0 1pb0 10N0 1pz0 10N0 1pb0 10N0 1pb0 11d0 1oL0 dW0 hfB0 Db0 1fB0 Rb0 npB0 11z0 1C10 IL0 1s10 10n0 1o10 WL0 1zd0 On0 1ld0 11z0 1o10 14n0 1o10 14n0 1nd0 12n0 1nd0 Xz0 1q10 12n0 M10 C00 17c0 1io0 17c0 1io0 17c0 1o00 1cL0 1fB0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 17c0 1io0 18N0 1bz0 19z0 1gp0 1610 1iL0 11z0 1o10 14o0 1lA1 SKX 1xd1 MKX 1AN0 1a00 1fA0 1cL0 1cN0 1nX0 1210 1nz0 1220 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0|18e5",
		"Asia/Hebron|EET EEST IST IDT|-20 -30 -20 -30|01010101010101010101010101010101232323232323232323232323232010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-1c2q0 5Rb0 10r0 1px0 10N0 1pz0 16p0 1jB0 16p0 1jx0 pBd0 Vz0 1oN0 11b0 1oO0 10N0 1pz0 10N0 1pb0 10N0 1pb0 10N0 1pb0 10N0 1pz0 10N0 1pb0 10N0 1pb0 11d0 1oL0 dW0 hfB0 Db0 1fB0 Rb0 npB0 11z0 1C10 IL0 1s10 10n0 1o10 WL0 1zd0 On0 1ld0 11z0 1o10 14n0 1o10 14n0 1nd0 12n0 1nd0 Xz0 1q10 12n0 M10 C00 17c0 1io0 17c0 1io0 17c0 1o00 1cL0 1fB0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 17c0 1io0 18N0 1bz0 19z0 1gp0 1610 1iL0 12L0 1mN0 14o0 1lc0 Tb0 1xd1 MKX bB0 cn0 1cN0 1a00 1fA0 1cL0 1cN0 1nX0 1210 1nz0 1220 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 1qL0|25e4",
		"Asia/Ho_Chi_Minh|LMT PLMT +07 +08 +09|-76.E -76.u -70 -80 -90|0123423232|-2yC76.E bK00.a 1h7b6.u 5lz0 18o0 3Oq0 k5b0 aW00 BAM0|90e5",
		"Asia/Hong_Kong|LMT HKT HKST JST|-7A.G -80 -90 -90|0121312121212121212121212121212121212121212121212121212121212121212121|-2CFHA.G 1sEP6.G 1cL0 ylu 93X0 1qQu 1tX0 Rd0 1In0 NB0 1cL0 11B0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1kL0 14N0 1nX0 U10 1tz0 U10 1wn0 Rd0 1wn0 U10 1tz0 U10 1tz0 U10 1tz0 U10 1wn0 Rd0 1wn0 Rd0 1wn0 U10 1tz0 U10 1tz0 17d0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 s10 1Vz0 1cN0 1cL0 1cN0 1cL0 6fd0 14n0|73e5",
		"Asia/Hovd|LMT +06 +07 +08|-66.A -60 -70 -80|012323232323232323232323232323232323232323232323232|-2APG6.A 2Uko6.A cKn0 1db0 1dd0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1fB0 1cL0 1cN0 1cL0 1cN0 1cL0 6hD0 11z0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 kEp0 1cJ0 1cP0 1cJ0|81e3",
		"Asia/Irkutsk|IMT +07 +08 +09|-6V.5 -70 -80 -90|01232323232323232323232123232323232323232323232323232323232323232|-21zGV.5 pjXV.5 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|60e4",
		"Europe/Istanbul|IMT EET EEST +04 +03|-1U.U -20 -30 -40 -30|012121212121212121212121212121212121212121212121212121234343434342121212121212121212121212121212121212121212121212121212121212124|-2ogNU.U dzzU.U 11b0 8tB0 1on0 1410 1db0 19B0 1in0 3Rd0 Un0 1oN0 11b0 zSp0 CL0 mN0 1Vz0 1gN0 1pz0 5Rd0 1fz0 1yp0 ML0 1kp0 17b0 1ip0 17b0 1fB0 19X0 1jB0 18L0 1ip0 17z0 qdd0 xX0 3S10 Tz0 dA10 11z0 1o10 11z0 1qN0 11z0 1ze0 11B0 WM0 1qO0 WI0 1nX0 1rB0 10L0 11B0 1in0 17d0 1in0 2pX0 19E0 1fU0 16Q0 1iI0 16Q0 1iI0 1Vd0 pb0 3Kp0 14o0 1de0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1a00 1fA0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WO0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 Xc0 1qo0 WM0 1qM0 11A0 1o00 1200 1nA0 11A0 1tA0 U00 15w0|13e6",
		"Asia/Jakarta|BMT +0720 +0730 +09 +08 WIB|-77.c -7k -7u -90 -80 -70|01232425|-1Q0Tk luM0 mPzO 8vWu 6kpu 4PXu xhcu|31e6",
		"Asia/Jayapura|LMT +09 +0930 WIT|-9m.M -90 -9u -90|0123|-1uu9m.M sMMm.M L4nu|26e4",
		"Asia/Jerusalem|JMT IST IDT IDDT|-2k.E -20 -30 -40|01212121212132121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-26Bek.E SyMk.E 5Rb0 10r0 1px0 10N0 1pz0 16p0 1jB0 16p0 1jx0 3LB0 Em0 or0 1cn0 1dB0 16n0 10O0 1ja0 1tC0 14o0 1cM0 1a00 11A0 1Na0 An0 1MP0 AJ0 1Kp0 LC0 1oo0 Wl0 EQN0 Db0 1fB0 Rb0 npB0 11z0 1C10 IL0 1s10 10n0 1o10 WL0 1zd0 On0 1ld0 11z0 1o10 14n0 1o10 14n0 1nd0 12n0 1nd0 Xz0 1q10 12n0 1hB0 1dX0 1ep0 1aL0 1eN0 17X0 1nf0 11z0 1tB0 19W0 1e10 17b0 1ep0 1gL0 18N0 1fz0 1eN0 17b0 1gq0 1gn0 19d0 1dz0 1c10 17X0 1hB0 1gn0 19d0 1dz0 1c10 17X0 1kp0 1dz0 1c10 1aL0 1eN0 1oL0 10N0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0 10N0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0 10N0 1oL0 10N0 1rz0 W10 1rz0 W10 1rz0 W10 1rz0 10N0 1oL0 10N0 1oL0|81e4",
		"Asia/Kabul|+04 +0430|-40 -4u|01|-10Qs0|46e5",
		"Asia/Kamchatka|LMT +11 +12 +13|-ay.A -b0 -c0 -d0|012323232323232323232321232323232323232323232323232323232323212|-1SLKy.A ivXy.A 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 2sp0 WM0|18e4",
		"Asia/Karachi|LMT +0530 +0630 +05 PKT PKST|-4s.c -5u -6u -50 -50 -60|012134545454|-2xoss.c 1qOKW.c 7zX0 eup0 LqMu 1fy00 1cL0 dK10 11b0 1610 1jX0|24e6",
		"Asia/Urumqi|LMT +06|-5O.k -60|01|-1GgtO.k|32e5",
		"Asia/Kathmandu|LMT +0530 +0545|-5F.g -5u -5J|012|-21JhF.g 2EGMb.g|12e5",
		"Asia/Khandyga|LMT +08 +09 +10 +11|-92.d -80 -90 -a0 -b0|0123232323232323232323212323232323232323232323232343434343434343432|-21Q92.d pAp2.d 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 qK0 yN0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 17V0 7zD0|66e2",
		"Asia/Krasnoyarsk|LMT +06 +07 +08|-6b.q -60 -70 -80|01232323232323232323232123232323232323232323232323232323232323232|-21Hib.q prAb.q 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|10e5",
		"Asia/Kuala_Lumpur|SMT +07 +0720 +0730 +09 +08|-6T.p -70 -7k -7u -90 -80|0123435|-2Bg6T.p 17anT.p l5XE 17bO 8Fyu 1so1u|71e5",
		"Asia/Kuching|LMT +0730 +08 +0820 +09|-7l.k -7u -80 -8k -90|0123232323232323242|-1KITl.k gDbP.k 6ynu AnE 1O0k AnE 1NAk AnE 1NAk AnE 1NAk AnE 1O0k AnE 1NAk AnE pAk 8Fz0|13e4",
		"Asia/Macau|LMT CST CDT|-7y.k -80 -90|012121212121212121212121212121212121212121|-2le7y.k 1XO34.k 1wn0 Rd0 1wn0 R9u 1wqu U10 1tz0 TVu 1tz0 17gu 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cJu 1cL0 1cN0 1fz0 1cN0 1cOu 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cJu 1cL0 1cN0 1fz0 1cN0 1cL0|57e4",
		"Asia/Magadan|LMT +10 +11 +12|-a3.c -a0 -b0 -c0|012323232323232323232321232323232323232323232323232323232323232312|-1Pca3.c eUo3.c 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0 3Cq0|95e3",
		"Asia/Makassar|LMT MMT +08 +09 WITA|-7V.A -7V.A -80 -90 -80|01234|-21JjV.A vfc0 myLV.A 8ML0|15e5",
		"Asia/Manila|+08 +09|-80 -90|010101010|-1kJI0 AL0 cK10 65X0 mXB0 vX0 VK10 1db0|24e6",
		"Asia/Nicosia|LMT EET EEST|-2d.s -20 -30|01212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-1Vc2d.s 2a3cd.s 1cL0 1qp0 Xz0 19B0 19X0 1fB0 1db0 1cp0 1cL0 1fB0 19X0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1fB0 1cL0 1cN0 1cL0 1cN0 1o30 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|32e4",
		"Asia/Novokuznetsk|LMT +06 +07 +08|-5M.M -60 -70 -80|012323232323232323232321232323232323232323232323232323232323212|-1PctM.M eULM.M 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 2sp0 WM0|55e4",
		"Asia/Novosibirsk|LMT +06 +07 +08|-5v.E -60 -70 -80|0123232323232323232323212323212121212121212121212121212121212121212|-21Qnv.E pAFv.E 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 ml0 Os0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0 4eN0|15e5",
		"Asia/Omsk|LMT +05 +06 +07|-4R.u -50 -60 -70|01232323232323232323232123232323232323232323232323232323232323232|-224sR.u pMLR.u 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|12e5",
		"Asia/Oral|LMT +03 +05 +06 +04|-3p.o -30 -50 -60 -40|01232323232323232424242424242424242424242424242|-1Pc3p.o eUop.o 23CK0 3Db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 2pB0 1cM0 1fA0 1cM0 1cM0 IM0 1EM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0|27e4",
		"Asia/Pontianak|LMT PMT +0730 +09 +08 WITA WIB|-7h.k -7h.k -7u -90 -80 -80 -70|012324256|-2ua7h.k XE00 munL.k 8Rau 6kpu 4PXu xhcu Wqnu|23e4",
		"Asia/Pyongyang|LMT KST JST KST|-8n -8u -90 -90|01231|-2um8n 97XR 1lTzu 2Onc0|29e5",
		"Asia/Qyzylorda|LMT +04 +05 +06|-4l.Q -40 -50 -60|0123232323232323232323232323232323232323232323|-1Pc4l.Q eUol.Q 23CL0 3Db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 3ao0 1EM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0|73e4",
		"Asia/Rangoon|RMT +0630 +09|-6o.L -6u -90|0121|-21Jio.L SmnS.L 7j9u|48e5",
		"Asia/Sakhalin|LMT +09 +11 +12 +10|-9u.M -90 -b0 -c0 -a0|01232323232323232323232423232323232424242424242424242424242424242|-2AGVu.M 1BoMu.M 1qFa0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 2pB0 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0 3rd0|58e4",
		"Asia/Samarkand|LMT +04 +05 +06|-4r.R -40 -50 -60|01232323232323232323232|-1Pc4r.R eUor.R 23CL0 3Db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0|36e4",
		"Asia/Seoul|LMT KST JST KST KDT KDT|-8r.Q -8u -90 -90 -9u -a0|0123141414141414135353|-2um8r.Q 97XV.Q 1m1zu kKo0 2I0u OL0 1FB0 Rb0 1qN0 TX0 1tB0 TX0 1tB0 TX0 1tB0 TX0 2ap0 12FBu 11A0 1o00 11A0|23e6",
		"Asia/Srednekolymsk|LMT +10 +11 +12|-ae.Q -a0 -b0 -c0|01232323232323232323232123232323232323232323232323232323232323232|-1Pcae.Q eUoe.Q 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|35e2",
		"Asia/Taipei|CST JST CDT|-80 -90 -90|01020202020202020202020202020202020202020|-1iw80 joM0 1yo0 Tz0 1ip0 1jX0 1cN0 11b0 1oN0 11b0 1oN0 11b0 1oN0 11b0 10N0 1BX0 10p0 1pz0 10p0 1pz0 10p0 1db0 1dd0 1db0 1cN0 1db0 1cN0 1db0 1cN0 1db0 1BB0 ML0 1Bd0 ML0 uq10 1db0 1cN0 1db0 97B0 AL0|74e5",
		"Asia/Tashkent|LMT +05 +06 +07|-4B.b -50 -60 -70|012323232323232323232321|-1Pc4B.b eUnB.b 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0|23e5",
		"Asia/Tbilisi|TBMT +03 +04 +05|-2X.b -30 -40 -50|0123232323232323232323212121232323232323232323212|-1Pc2X.b 1jUnX.b WCL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 1cK0 1cL0 1cN0 1cL0 1cN0 2pz0 1cL0 1fB0 3Nz0 11B0 1nX0 11B0 1qL0 WN0 1qL0 WN0 1qL0 11B0 1nX0 11B0 1nX0 11B0 An0 Os0 WM0|11e5",
		"Asia/Tehran|LMT TMT +0330 +04 +05 +0430|-3p.I -3p.I -3u -40 -50 -4u|01234325252525252525252525252525252525252525252525252525252525252525252525252525252525252525252525252|-2btDp.I 1d3c0 1huLT.I TXu 1pz0 sN0 vAu 1cL0 1dB0 1en0 pNB0 UL0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 64p0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0 1cN0 1dz0 1cp0 1dz0 1cp0 1dz0 1cp0 1dz0|14e6",
		"Asia/Thimphu|LMT +0530 +06|-5W.A -5u -60|012|-Su5W.A 1BGMs.A|79e3",
		"Asia/Tokyo|JST JDT|-90 -a0|010101010|-QJH0 QL0 1lB0 13X0 1zB0 NX0 1zB0 NX0|38e6",
		"Asia/Tomsk|LMT +06 +07 +08|-5D.P -60 -70 -80|0123232323232323232323212323232323232323232323212121212121212121212|-21NhD.P pxzD.P 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 co0 1bB0 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0 3Qp0|10e5",
		"Asia/Ulaanbaatar|LMT +07 +08 +09|-77.w -70 -80 -90|012323232323232323232323232323232323232323232323232|-2APH7.w 2Uko7.w cKn0 1db0 1dd0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1fB0 1cL0 1cN0 1cL0 1cN0 1cL0 6hD0 11z0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 kEp0 1cJ0 1cP0 1cJ0|12e5",
		"Asia/Ust-Nera|LMT +08 +09 +12 +11 +10|-9w.S -80 -90 -c0 -b0 -a0|012343434343434343434345434343434343434343434343434343434343434345|-21Q9w.S pApw.S 23CL0 1d90 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 17V0 7zD0|65e2",
		"Asia/Vladivostok|LMT +09 +10 +11|-8L.v -90 -a0 -b0|01232323232323232323232123232323232323232323232323232323232323232|-1SJIL.v itXL.v 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|60e4",
		"Asia/Yakutsk|LMT +08 +09 +10|-8C.W -80 -90 -a0|01232323232323232323232123232323232323232323232323232323232323232|-21Q8C.W pAoC.W 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|28e4",
		"Asia/Yekaterinburg|LMT PMT +04 +05 +06|-42.x -3J.5 -40 -50 -60|012343434343434343434343234343434343434343434343434343434343434343|-2ag42.x 7mQh.s qBvJ.5 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|14e5",
		"Asia/Yerevan|LMT +03 +04 +05|-2W -30 -40 -50|0123232323232323232323212121212323232323232323232323232323232|-1Pc2W 1jUnW WCL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 2pB0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 4RX0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0|13e5",
		"Atlantic/Azores|HMT -02 -01 +00 WET|1S.w 20 10 0 0|01212121212121212121212121212121212121212121232123212321232121212121212121212121212121212121212121232323232323232323232323232323234323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232|-2ldW5.s aPX5.s Sp0 LX0 1vc0 Tc0 1uM0 SM0 1vc0 Tc0 1vc0 SM0 1vc0 6600 1co0 3E00 17c0 1fA0 1a00 1io0 1a00 1io0 17c0 3I00 17c0 1cM0 1cM0 3Fc0 1cM0 1a00 1fA0 1io0 17c0 1cM0 1cM0 1a00 1fA0 1io0 1qM0 Dc0 1tA0 1cM0 1dc0 1400 gL0 IM0 s10 U00 dX0 Rc0 pd0 Rc0 gL0 Oo0 pd0 Rc0 gL0 Oo0 pd0 14o0 1cM0 1cP0 1cM0 1cM0 1cM0 1cM0 1cM0 3Co0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 qIl0 1cM0 1fA0 1cM0 1cM0 1cN0 1cL0 1cN0 1cM0 1cM0 1cM0 1cM0 1cN0 1cL0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cL0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|25e4",
		"Atlantic/Bermuda|LMT AST ADT|4j.i 40 30|0121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-1BnRE.G 1LTbE.G 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0|65e3",
		"Atlantic/Canary|LMT -01 WET WEST|11.A 10 0 -10|01232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232|-1UtaW.o XPAW.o 1lAK0 1a10 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|54e4",
		"Atlantic/Cape_Verde|LMT -02 -01|1y.4 20 10|01212|-2xomp.U 1qOMp.U 7zX0 1djf0|50e4",
		"Atlantic/Faroe|LMT WET WEST|r.4 0 -10|01212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2uSnw.U 2Wgow.U 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|49e3",
		"Atlantic/Madeira|FMT -01 +00 +01 WET WEST|17.A 10 0 -10 0 -10|01212121212121212121212121212121212121212121232123212321232121212121212121212121212121212121212121454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454|-2ldWQ.o aPWQ.o Sp0 LX0 1vc0 Tc0 1uM0 SM0 1vc0 Tc0 1vc0 SM0 1vc0 6600 1co0 3E00 17c0 1fA0 1a00 1io0 1a00 1io0 17c0 3I00 17c0 1cM0 1cM0 3Fc0 1cM0 1a00 1fA0 1io0 17c0 1cM0 1cM0 1a00 1fA0 1io0 1qM0 Dc0 1tA0 1cM0 1dc0 1400 gL0 IM0 s10 U00 dX0 Rc0 pd0 Rc0 gL0 Oo0 pd0 Rc0 gL0 Oo0 pd0 14o0 1cM0 1cP0 1cM0 1cM0 1cM0 1cM0 1cM0 3Co0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 qIl0 1cM0 1fA0 1cM0 1cM0 1cN0 1cL0 1cN0 1cM0 1cM0 1cM0 1cM0 1cN0 1cL0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|27e4",
		"Atlantic/Reykjavik|LMT -01 +00 GMT|1s 10 0 0|012121212121212121212121212121212121212121212121212121212121212121213|-2uWmw mfaw 1Bd0 ML0 1LB0 Cn0 1LB0 3fX0 C10 HrX0 1cO0 LB0 1EL0 LA0 1C00 Oo0 1wo0 Rc0 1wo0 Rc0 1wo0 Rc0 1zc0 Oo0 1zc0 14o0 1lc0 14o0 1lc0 14o0 1o00 11A0 1lc0 14o0 1o00 14o0 1lc0 14o0 1lc0 14o0 1lc0 14o0 1lc0 14o0 1o00 14o0 1lc0 14o0 1lc0 14o0 1lc0 14o0 1lc0 14o0 1lc0 14o0 1o00 14o0 1lc0 14o0 1lc0 14o0 1lc0 14o0 1lc0 14o0 1o00 14o0|12e4",
		"Atlantic/South_Georgia|-02|20|0||30",
		"Atlantic/Stanley|SMT -04 -03 -02|3P.o 40 30 20|012121212121212323212121212121212121212121212121212121212121212121212|-2kJw8.A 12bA8.A 19X0 1fB0 19X0 1ip0 19X0 1fB0 19X0 1fB0 19X0 1fB0 Cn0 1Cc10 WL0 1qL0 U10 1tz0 2mN0 WN0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1tz0 U10 1tz0 WN0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1tz0 WN0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1qL0 WN0 1qN0 U10 1wn0 Rd0 1wn0 U10 1tz0 U10 1tz0 U10 1tz0 U10 1tz0 U10 1wn0 U10 1tz0 U10 1tz0 U10|21e2",
		"Australia/Sydney|AEST AEDT|-a0 -b0|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101|-293lX xcX 10jd0 yL0 1cN0 1cL0 1fB0 19X0 17c10 LA0 1C00 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 14o0 1o00 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 U00 1qM0 WM0 1tA0 WM0 1tA0 U00 1tA0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 11A0 1o00 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 WM0 1qM0 14o0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0|40e5",
		"Australia/Adelaide|ACST ACDT|-9u -au|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101|-293lt xcX 10jd0 yL0 1cN0 1cL0 1fB0 19X0 17c10 LA0 1C00 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 U00 1qM0 WM0 1tA0 WM0 1tA0 U00 1tA0 U00 1tA0 Oo0 1zc0 WM0 1qM0 Rc0 1zc0 U00 1tA0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 WM0 1qM0 14o0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0|11e5",
		"Australia/Brisbane|AEST AEDT|-a0 -b0|01010101010101010|-293lX xcX 10jd0 yL0 1cN0 1cL0 1fB0 19X0 17c10 LA0 H1A0 Oo0 1zc0 Oo0 1zc0 Oo0|20e5",
		"Australia/Broken_Hill|ACST ACDT|-9u -au|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101|-293lt xcX 10jd0 yL0 1cN0 1cL0 1fB0 19X0 17c10 LA0 1C00 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 14o0 1o00 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 U00 1qM0 WM0 1tA0 WM0 1tA0 U00 1tA0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 WM0 1qM0 14o0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0|18e3",
		"Australia/Currie|AEST AEDT|-a0 -b0|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101|-29E80 19X0 10jd0 yL0 1cN0 1cL0 1fB0 19X0 17c10 LA0 1C00 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 11A0 1qM0 WM0 1qM0 Oo0 1zc0 Oo0 1zc0 Oo0 1wo0 WM0 1tA0 WM0 1tA0 U00 1tA0 U00 1tA0 11A0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 11A0 1o00 1io0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1cM0 1a00 1io0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0|746",
		"Australia/Darwin|ACST ACDT|-9u -au|010101010|-293lt xcX 10jd0 yL0 1cN0 1cL0 1fB0 19X0|12e4",
		"Australia/Eucla|+0845 +0945|-8J -9J|0101010101010101010|-293kI xcX 10jd0 yL0 1cN0 1cL0 1gSp0 Oo0 l5A0 Oo0 iJA0 G00 zU00 IM0 1qM0 11A0 1o00 11A0|368",
		"Australia/Hobart|AEST AEDT|-a0 -b0|010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101|-29E80 19X0 10jd0 yL0 1cN0 1cL0 1fB0 19X0 VfB0 1cM0 1o00 Rc0 1wo0 Rc0 1wo0 U00 1wo0 LA0 1C00 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 11A0 1qM0 WM0 1qM0 Oo0 1zc0 Oo0 1zc0 Oo0 1wo0 WM0 1tA0 WM0 1tA0 U00 1tA0 U00 1tA0 11A0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 11A0 1o00 1io0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1cM0 1a00 1io0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0|21e4",
		"Australia/Lord_Howe|AEST +1030 +1130 +11|-a0 -au -bu -b0|0121212121313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313131313|raC0 1zdu Rb0 1zd0 On0 1zd0 On0 1zd0 On0 1zd0 TXu 1qMu WLu 1tAu WLu 1tAu TXu 1tAu Onu 1zcu Onu 1zcu Onu 1zcu Rbu 1zcu Onu 1zcu Onu 1zcu 11zu 1o0u 11zu 1o0u 11zu 1o0u 11zu 1qMu WLu 11Au 1nXu 1qMu 11zu 1o0u 11zu 1o0u 11zu 1qMu WLu 1qMu 11zu 1o0u WLu 1qMu 14nu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1fAu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1fAu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1fzu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1fAu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1cMu 1cLu 1fAu 1cLu 1cMu 1cLu 1cMu|347",
		"Australia/Lindeman|AEST AEDT|-a0 -b0|010101010101010101010|-293lX xcX 10jd0 yL0 1cN0 1cL0 1fB0 19X0 17c10 LA0 H1A0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0|10",
		"Australia/Melbourne|AEST AEDT|-a0 -b0|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101|-293lX xcX 10jd0 yL0 1cN0 1cL0 1fB0 19X0 17c10 LA0 1C00 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 U00 1qM0 WM0 1qM0 11A0 1tA0 U00 1tA0 U00 1tA0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 11A0 1o00 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 WM0 1qM0 14o0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0|39e5",
		"Australia/Perth|AWST AWDT|-80 -90|0101010101010101010|-293jX xcX 10jd0 yL0 1cN0 1cL0 1gSp0 Oo0 l5A0 Oo0 iJA0 G00 zU00 IM0 1qM0 11A0 1o00 11A0|18e5",
		"CET|CET CEST|-10 -20|01010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2aFe0 11d0 1iO0 11A0 1o00 11A0 Qrc0 6i00 WM0 1fA0 1cM0 1cM0 1cM0 16M0 1gMM0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00",
		"CST6CDT|CST CDT CWT CPT|60 50 50 50|010102301010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-261s0 1nX0 11B0 1nX0 SgN0 8x30 iw0 QwN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"Pacific/Easter|EMT -07 -06 -05|7h.s 70 60 50|012121212121212121212121212123232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323|-1uSgG.w 1s4IG.w WL0 1zd0 On0 1ip0 11z0 1o10 11z0 1qN0 WL0 1ld0 14n0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 WL0 1qN0 11z0 1o10 2pA0 11z0 1o10 11z0 1qN0 WL0 1qN0 WL0 1qN0 1cL0 1cN0 11z0 1o10 11z0 1qN0 WL0 1fB0 19X0 1qN0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 17b0 1ip0 11z0 1ip0 1fz0 1fB0 11z0 1qN0 WL0 1qN0 WL0 1qN0 WL0 1qN0 11z0 1o10 11z0 1o10 11z0 1qN0 WL0 1qN0 17b0 1ip0 11z0 1o10 19X0 1fB0 1nX0 G10 1EL0 Op0 1zb0 Rd0 1wn0 Rd0 46n0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Dd0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Dd0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Dd0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0 1Nb0 Ap0|30e2",
		"EET|EET EEST|-20 -30|010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|hDB0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00",
		"EST|EST|50|0|",
		"EST5EDT|EST EDT EWT EPT|50 40 40 40|010102301010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-261t0 1nX0 11B0 1nX0 SgN0 8x40 iv0 QwN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"Europe/Dublin|DMT IST GMT BST IST|p.l -y.D 0 -10 -10|01232323232324242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242424242|-2ax9y.D Rc0 1fzy.D 14M0 1fc0 1g00 1co0 1dc0 1co0 1oo0 1400 1dc0 19A0 1io0 1io0 WM0 1o00 14o0 1o00 17c0 1io0 17c0 1fA0 1a00 1lc0 17c0 1io0 17c0 1fA0 1a00 1io0 17c0 1io0 17c0 1fA0 1cM0 1io0 17c0 1fA0 1a00 1io0 17c0 1io0 17c0 1fA0 1a00 1io0 1qM0 Dc0 g600 14o0 1wo0 17c0 1io0 11A0 1o00 17c0 1fA0 1a00 1fA0 1cM0 1fA0 1a00 17c0 1fA0 1a00 1io0 17c0 1lc0 17c0 1fA0 1a00 1io0 17c0 1io0 17c0 1fA0 1a00 1a00 1qM0 WM0 1qM0 11A0 1o00 WM0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1tA0 IM0 90o0 U00 1tA0 U00 1tA0 U00 1tA0 U00 1tA0 WM0 1qM0 WM0 1qM0 WM0 1tA0 U00 1tA0 U00 1tA0 11z0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 14o0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|12e5",
		"Etc/GMT+0|GMT|0|0|",
		"Etc/GMT+1|-01|10|0|",
		"Etc/GMT+10|-10|a0|0|",
		"Etc/GMT+11|-11|b0|0|",
		"Etc/GMT+12|-12|c0|0|",
		"Etc/GMT+3|-03|30|0|",
		"Etc/GMT+4|-04|40|0|",
		"Etc/GMT+5|-05|50|0|",
		"Etc/GMT+6|-06|60|0|",
		"Etc/GMT+7|-07|70|0|",
		"Etc/GMT+8|-08|80|0|",
		"Etc/GMT+9|-09|90|0|",
		"Etc/GMT-1|+01|-10|0|",
		"Pacific/Port_Moresby|+10|-a0|0||25e4",
		"Pacific/Pohnpei|+11|-b0|0||34e3",
		"Pacific/Tarawa|+12|-c0|0||29e3",
		"Etc/GMT-13|+13|-d0|0|",
		"Etc/GMT-14|+14|-e0|0|",
		"Etc/GMT-2|+02|-20|0|",
		"Etc/GMT-3|+03|-30|0|",
		"Etc/GMT-4|+04|-40|0|",
		"Etc/GMT-5|+05|-50|0|",
		"Etc/GMT-6|+06|-60|0|",
		"Indian/Christmas|+07|-70|0||21e2",
		"Etc/GMT-8|+08|-80|0|",
		"Pacific/Palau|+09|-90|0||21e3",
		"Etc/UCT|UCT|0|0|",
		"Etc/UTC|UTC|0|0|",
		"Europe/Amsterdam|AMT NST +0120 +0020 CEST CET|-j.w -1j.w -1k -k -20 -10|010101010101010101010101010101010101010101012323234545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545|-2aFcj.w 11b0 1iP0 11A0 1io0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1co0 1io0 1yo0 Pc0 1a00 1fA0 1Bc0 Mo0 1tc0 Uo0 1tA0 U00 1uo0 W00 1s00 VA0 1so0 Vc0 1sM0 UM0 1wo0 Rc0 1u00 Wo0 1rA0 W00 1s00 VA0 1sM0 UM0 1w00 fV0 BCX.w 1tA0 U00 1u00 Wo0 1sm0 601k WM0 1fA0 1cM0 1cM0 1cM0 16M0 1gMM0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|16e5",
		"Europe/Andorra|WET CET CEST|0 -10 -20|012121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-UBA0 1xIN0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|79e3",
		"Europe/Astrakhan|LMT +03 +04 +05|-3c.c -30 -40 -50|012323232323232323212121212121212121212121212121212121212121212|-1Pcrc.c eUMc.c 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 2pB0 1cM0 1fA0 1cM0 3Co0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0 3rd0",
		"Europe/Athens|AMT EET EEST CEST CET|-1y.Q -20 -30 -20 -10|012123434121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2a61x.Q CNbx.Q mn0 kU10 9b0 3Es0 Xa0 1fb0 1dd0 k3X0 Nz0 SCp0 1vc0 SO0 1cM0 1a00 1ao0 1fc0 1a10 1fG0 1cg0 1dX0 1bX0 1cQ0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|35e5",
		"Europe/London|GMT BST BDST|0 -10 -20|0101010101010101010101010101010101010101010101010121212121210101210101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2axa0 Rc0 1fA0 14M0 1fc0 1g00 1co0 1dc0 1co0 1oo0 1400 1dc0 19A0 1io0 1io0 WM0 1o00 14o0 1o00 17c0 1io0 17c0 1fA0 1a00 1lc0 17c0 1io0 17c0 1fA0 1a00 1io0 17c0 1io0 17c0 1fA0 1cM0 1io0 17c0 1fA0 1a00 1io0 17c0 1io0 17c0 1fA0 1a00 1io0 1qM0 Dc0 2Rz0 Dc0 1zc0 Oo0 1zc0 Rc0 1wo0 17c0 1iM0 FA0 xB0 1fA0 1a00 14o0 bb0 LA0 xB0 Rc0 1wo0 11A0 1o00 17c0 1fA0 1a00 1fA0 1cM0 1fA0 1a00 17c0 1fA0 1a00 1io0 17c0 1lc0 17c0 1fA0 1a00 1io0 17c0 1io0 17c0 1fA0 1a00 1a00 1qM0 WM0 1qM0 11A0 1o00 WM0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1tA0 IM0 90o0 U00 1tA0 U00 1tA0 U00 1tA0 U00 1tA0 WM0 1qM0 WM0 1qM0 WM0 1tA0 U00 1tA0 U00 1tA0 11z0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1o00 14o0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|10e6",
		"Europe/Belgrade|CET CEST|-10 -20|01010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-19RC0 3IP0 WM0 1fA0 1cM0 1cM0 1rc0 Qo0 1vmo0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|12e5",
		"Europe/Berlin|CET CEST CEMT|-10 -20 -30|01010101010101210101210101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2aFe0 11d0 1iO0 11A0 1o00 11A0 Qrc0 6i00 WM0 1fA0 1cM0 1cM0 1cM0 kL0 Nc0 m10 WM0 1ao0 1cp0 dX0 jz0 Dd0 1io0 17c0 1fA0 1a00 1ehA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|41e5",
		"Europe/Prague|CET CEST|-10 -20|010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2aFe0 11d0 1iO0 11A0 1o00 11A0 Qrc0 6i00 WM0 1fA0 1cM0 16M0 1lc0 1tA0 17A0 11c0 1io0 17c0 1io0 17c0 1fc0 1ao0 1bNc0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|13e5",
		"Europe/Brussels|WET CET CEST WEST|0 -10 -20 -10|0121212103030303030303030303030303030303030303030303212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2ehc0 3zX0 11c0 1iO0 11A0 1o00 11A0 my0 Ic0 1qM0 Rc0 1EM0 UM0 1u00 10o0 1io0 1io0 17c0 1a00 1fA0 1cM0 1cM0 1io0 17c0 1fA0 1a00 1io0 1a30 1io0 17c0 1fA0 1a00 1io0 17c0 1cM0 1cM0 1a00 1io0 1cM0 1cM0 1a00 1fA0 1io0 17c0 1cM0 1cM0 1a00 1fA0 1io0 1qM0 Dc0 y00 5Wn0 WM0 1fA0 1cM0 16M0 1iM0 16M0 1C00 Uo0 1eeo0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|21e5",
		"Europe/Bucharest|BMT EET EEST|-1I.o -20 -30|0121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-1xApI.o 20LI.o RA0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1Axc0 On0 1fA0 1a10 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cK0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cL0 1cN0 1cL0 1fB0 1nX0 11E0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|19e5",
		"Europe/Budapest|CET CEST|-10 -20|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2aFe0 11d0 1iO0 11A0 1ip0 17b0 1op0 1tb0 Q2m0 3Ne0 WM0 1fA0 1cM0 1cM0 1oJ0 1dc0 1030 1fA0 1cM0 1cM0 1cM0 1cM0 1fA0 1a00 1iM0 1fA0 8Ha0 Rb0 1wN0 Rb0 1BB0 Lz0 1C20 LB0 SNX0 1a10 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|17e5",
		"Europe/Zurich|CET CEST|-10 -20|01010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-19Lc0 11A0 1o00 11A0 1xG10 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|38e4",
		"Europe/Chisinau|CMT BMT EET EEST CEST CET MSK MSD|-1T -1I.o -20 -30 -20 -10 -30 -40|012323232323232323234545467676767676767676767323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232|-26jdT wGMa.A 20LI.o RA0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 27A0 2en0 39g0 WM0 1fA0 1cM0 V90 1t7z0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 gL0 WO0 1cM0 1cM0 1cK0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1fB0 1nX0 11D0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|67e4",
		"Europe/Copenhagen|CET CEST|-10 -20|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2azC0 Tz0 VuO0 60q0 WM0 1fA0 1cM0 1cM0 1cM0 S00 1HA0 Nc0 1C00 Dc0 1Nc0 Ao0 1h5A0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|12e5",
		"Europe/Gibraltar|GMT BST BDST CET CEST|0 -10 -20 -10 -20|010101010101010101010101010101010101010101010101012121212121010121010101010101010101034343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343|-2axa0 Rc0 1fA0 14M0 1fc0 1g00 1co0 1dc0 1co0 1oo0 1400 1dc0 19A0 1io0 1io0 WM0 1o00 14o0 1o00 17c0 1io0 17c0 1fA0 1a00 1lc0 17c0 1io0 17c0 1fA0 1a00 1io0 17c0 1io0 17c0 1fA0 1cM0 1io0 17c0 1fA0 1a00 1io0 17c0 1io0 17c0 1fA0 1a00 1io0 1qM0 Dc0 2Rz0 Dc0 1zc0 Oo0 1zc0 Rc0 1wo0 17c0 1iM0 FA0 xB0 1fA0 1a00 14o0 bb0 LA0 xB0 Rc0 1wo0 11A0 1o00 17c0 1fA0 1a00 1fA0 1cM0 1fA0 1a00 17c0 1fA0 1a00 1io0 17c0 1lc0 17c0 1fA0 10Jz0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|30e3",
		"Europe/Helsinki|HMT EET EEST|-1D.N -20 -30|0121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-1WuND.N OULD.N 1dA0 1xGq0 1cM0 1cM0 1cM0 1cN0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|12e5",
		"Europe/Kaliningrad|CET CEST CET CEST MSK MSD EEST EET +03|-10 -20 -20 -30 -30 -40 -30 -20 -30|0101010101010232454545454545454546767676767676767676767676767676767676767676787|-2aFe0 11d0 1iO0 11A0 1o00 11A0 Qrc0 6i00 WM0 1fA0 1cM0 1cM0 Am0 Lb0 1en0 op0 1pNz0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cN0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|44e4",
		"Europe/Kiev|KMT EET MSK CEST CET MSD EEST|-22.4 -20 -30 -20 -10 -40 -30|0123434252525252525252525256161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161|-1Pc22.4 eUo2.4 rnz0 2Hg0 WM0 1fA0 da0 1v4m0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 Db0 3220 1cK0 1cL0 1cN0 1cL0 1cN0 1cL0 1cQ0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|34e5",
		"Europe/Kirov|LMT +03 +04 +05|-3i.M -30 -40 -50|01232323232323232321212121212121212121212121212121212121212121|-22WM0 qH90 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 2pB0 1cM0 1fA0 1cM0 3Co0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|48e4",
		"Europe/Lisbon|LMT WET WEST WEMT CET CEST|A.J 0 -10 -20 -10 -20|012121212121212121212121212121212121212121212321232123212321212121212121212121212121212121212121214121212121212121212121212121212124545454212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2ldXn.f aPWn.f Sp0 LX0 1vc0 Tc0 1uM0 SM0 1vc0 Tc0 1vc0 SM0 1vc0 6600 1co0 3E00 17c0 1fA0 1a00 1io0 1a00 1io0 17c0 3I00 17c0 1cM0 1cM0 3Fc0 1cM0 1a00 1fA0 1io0 17c0 1cM0 1cM0 1a00 1fA0 1io0 1qM0 Dc0 1tA0 1cM0 1dc0 1400 gL0 IM0 s10 U00 dX0 Rc0 pd0 Rc0 gL0 Oo0 pd0 Rc0 gL0 Oo0 pd0 14o0 1cM0 1cP0 1cM0 1cM0 1cM0 1cM0 1cM0 3Co0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 pvy0 1cM0 1cM0 1fA0 1cM0 1cM0 1cN0 1cL0 1cN0 1cM0 1cM0 1cM0 1cM0 1cN0 1cL0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|27e5",
		"Europe/Luxembourg|LMT CET CEST WET WEST WEST WET|-o.A -10 -20 0 -10 -20 -10|0121212134343434343434343434343434343434343434343434565651212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2DG0o.A t6mo.A TB0 1nX0 Up0 1o20 11A0 rW0 CM0 1qP0 R90 1EO0 UK0 1u20 10m0 1ip0 1in0 17e0 19W0 1fB0 1db0 1cp0 1in0 17d0 1fz0 1a10 1in0 1a10 1in0 17f0 1fA0 1a00 1io0 17c0 1cM0 1cM0 1a00 1io0 1cM0 1cM0 1a00 1fA0 1io0 17c0 1cM0 1cM0 1a00 1fA0 1io0 1qM0 Dc0 vA0 60L0 WM0 1fA0 1cM0 17c0 1io0 16M0 1C00 Uo0 1eeo0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|54e4",
		"Europe/Madrid|WET WEST WEMT CET CEST|0 -10 -20 -10 -20|010101010101010101210343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343|-25Td0 19B0 1cL0 1dd0 b1z0 18p0 3HX0 17d0 1fz0 1a10 1io0 1a00 1in0 17d0 iIn0 Hd0 1cL0 bb0 1200 2s20 14n0 5aL0 Mp0 1vz0 17d0 1in0 17d0 1in0 17d0 1in0 17d0 6hX0 11B0 XHX0 1a10 1fz0 1a10 19X0 1cN0 1fz0 1a10 1fC0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|62e5",
		"Europe/Malta|CET CEST|-10 -20|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2arB0 Lz0 1cN0 1db0 1410 1on0 Wp0 1qL0 17d0 1cL0 M3B0 5M20 WM0 1fA0 1co0 17c0 1iM0 16m0 1de0 1lc0 14m0 1lc0 WO0 1qM0 GTW0 On0 1C10 LA0 1C00 LA0 1EM0 LA0 1C00 LA0 1zc0 Oo0 1C00 Oo0 1co0 1cM0 1lA0 Xc0 1qq0 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1o10 11z0 1iN0 19z0 1fB0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|42e4",
		"Europe/Minsk|MMT EET MSK CEST CET MSD EEST +03|-1O -20 -30 -20 -10 -40 -30 -30|01234343252525252525252525261616161616161616161616161616161616161617|-1Pc1O eUnO qNX0 3gQ0 WM0 1fA0 1cM0 Al0 1tsn0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 3Fc0 1cN0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0|19e5",
		"Europe/Monaco|PMT WET WEST WEMT CET CEST|-9.l 0 -10 -20 -10 -20|01212121212121212121212121212121212121212121212121232323232345454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454|-2nco9.l cNb9.l HA0 19A0 1iM0 11c0 1oo0 Wo0 1rc0 QM0 1EM0 UM0 1u00 10o0 1io0 1wo0 Rc0 1a00 1fA0 1cM0 1cM0 1io0 17c0 1fA0 1a00 1io0 1a00 1io0 17c0 1fA0 1a00 1io0 17c0 1cM0 1cM0 1a00 1io0 1cM0 1cM0 1a00 1fA0 1io0 17c0 1cM0 1cM0 1a00 1fA0 1io0 1qM0 Df0 2RV0 11z0 11B0 1ze0 WM0 1fA0 1cM0 1fa0 1aq0 16M0 1ekn0 1cL0 1fC0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|38e3",
		"Europe/Moscow|MMT MMT MST MDST MSD MSK +05 EET EEST MSK|-2u.h -2v.j -3v.j -4v.j -40 -30 -50 -20 -30 -40|012132345464575454545454545454545458754545454545454545454545454545454545454595|-2ag2u.h 2pyW.W 1bA0 11X0 GN0 1Hb0 c4v.j ik0 3DA0 dz0 15A0 c10 2q10 iM10 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cN0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|16e6",
		"Europe/Paris|PMT WET WEST CEST CET WEMT|-9.l 0 -10 -20 -10 -20|0121212121212121212121212121212121212121212121212123434352543434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434343434|-2nco8.l cNb8.l HA0 19A0 1iM0 11c0 1oo0 Wo0 1rc0 QM0 1EM0 UM0 1u00 10o0 1io0 1wo0 Rc0 1a00 1fA0 1cM0 1cM0 1io0 17c0 1fA0 1a00 1io0 1a00 1io0 17c0 1fA0 1a00 1io0 17c0 1cM0 1cM0 1a00 1io0 1cM0 1cM0 1a00 1fA0 1io0 17c0 1cM0 1cM0 1a00 1fA0 1io0 1qM0 Df0 Ik0 5M30 WM0 1fA0 1cM0 Vx0 hB0 1aq0 16M0 1ekn0 1cL0 1fC0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|11e6",
		"Europe/Riga|RMT LST EET MSK CEST CET MSD EEST|-1A.y -2A.y -20 -30 -20 -10 -40 -30|010102345454536363636363636363727272727272727272727272727272727272727272727272727272727272727272727272727272727272727272727272|-25TzA.y 11A0 1iM0 ko0 gWm0 yDXA.y 2bX0 3fE0 WM0 1fA0 1cM0 1cM0 4m0 1sLy0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cN0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cN0 1o00 11A0 1o00 11A0 1qM0 3oo0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|64e4",
		"Europe/Rome|CET CEST|-10 -20|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2arB0 Lz0 1cN0 1db0 1410 1on0 Wp0 1qL0 17d0 1cL0 M3B0 5M20 WM0 1fA0 1cM0 16M0 1iM0 16m0 1de0 1lc0 14m0 1lc0 WO0 1qM0 GTW0 On0 1C10 LA0 1C00 LA0 1EM0 LA0 1C00 LA0 1zc0 Oo0 1C00 Oo0 1C00 LA0 1zc0 Oo0 1C00 LA0 1C00 LA0 1zc0 Oo0 1C00 Oo0 1zc0 Oo0 1fC0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|39e5",
		"Europe/Samara|LMT +03 +04 +05|-3k.k -30 -40 -50|0123232323232323232121232323232323232323232323232323232323212|-22WM0 qH90 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 2pB0 1cM0 1fA0 2y10 14m0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 2sp0 WM0|12e5",
		"Europe/Saratov|LMT +03 +04 +05|-34.i -30 -40 -50|012323232323232321212121212121212121212121212121212121212121212|-22WM0 qH90 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 2pB0 1cM0 1cM0 1cM0 1fA0 1cM0 3Co0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0 5810",
		"Europe/Simferopol|SMT EET MSK CEST CET MSD EEST MSK|-2g -20 -30 -20 -10 -40 -30 -40|012343432525252525252525252161616525252616161616161616161616161616161616172|-1Pc2g eUog rEn0 2qs0 WM0 1fA0 1cM0 3V0 1u0L0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1Q00 4eL0 1cL0 1cN0 1cL0 1cN0 dX0 WL0 1cN0 1cL0 1fB0 1o30 11B0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11z0 1nW0|33e4",
		"Europe/Sofia|EET CET CEST EEST|-20 -10 -20 -30|01212103030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030|-168L0 WM0 1fA0 1cM0 1cM0 1cN0 1mKH0 1dd0 1fb0 1ap0 1fb0 1a20 1fy0 1a30 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cK0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1fB0 1nX0 11E0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|12e5",
		"Europe/Stockholm|CET CEST|-10 -20|01010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2azC0 TB0 2yDe0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|15e5",
		"Europe/Tallinn|TMT CET CEST EET MSK MSD EEST|-1D -10 -20 -20 -30 -40 -30|012103421212454545454545454546363636363636363636363636363636363636363636363636363636363636363636363636363636363636363636363|-26oND teD 11A0 1Ta0 4rXl KSLD 2FX0 2Jg0 WM0 1fA0 1cM0 18J0 1sTX0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cN0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o10 11A0 1qM0 5QM0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|41e4",
		"Europe/Tirane|LMT CET CEST|-1j.k -10 -20|01212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2glBj.k 14pcj.k 5LC0 WM0 4M0 1fCK0 10n0 1op0 11z0 1pd0 11z0 1qN0 WL0 1qp0 Xb0 1qp0 Xb0 1qp0 11z0 1lB0 11z0 1qN0 11z0 1iN0 16n0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|42e4",
		"Europe/Ulyanovsk|LMT +03 +04 +05 +02|-3d.A -30 -40 -50 -20|01232323232323232321214121212121212121212121212121212121212121212|-22WM0 qH90 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 2pB0 1cM0 1fA0 2pB0 IM0 rX0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0 3rd0",
		"Europe/Uzhgorod|CET CEST MSK MSD EET EEST|-10 -20 -30 -40 -20 -30|010101023232323232323232320454545454545454545454545454545454545454545454545454545454545454545454545454545454545454545454|-1cqL0 6i00 WM0 1fA0 1cM0 1ml0 1Cp0 1r3W0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1Q00 1Nf0 2pw0 1cL0 1cN0 1cL0 1cN0 1cL0 1cQ0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|11e4",
		"Europe/Vienna|CET CEST|-10 -20|0101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2aFe0 11d0 1iO0 11A0 1o00 11A0 3KM0 14o0 LA00 6i00 WM0 1fA0 1cM0 1cM0 1cM0 400 2qM0 1a00 1cM0 1cM0 1io0 17c0 1gHa0 19X0 1cP0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|18e5",
		"Europe/Vilnius|WMT KMT CET EET MSK CEST MSD EEST|-1o -1z.A -10 -20 -30 -20 -40 -30|012324525254646464646464646473737373737373737352537373737373737373737373737373737373737373737373737373737373737373737373|-293do 6ILM.o 1Ooz.A zz0 Mfd0 29W0 3is0 WM0 1fA0 1cM0 LV0 1tgL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cN0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11B0 1o00 11A0 1qM0 8io0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|54e4",
		"Europe/Volgograd|LMT +03 +04 +05|-2V.E -30 -40 -50|01232323232323232121212121212121212121212121212121212121212121|-21IqV.E psLV.E 23CL0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 2pB0 1cM0 1cM0 1cM0 1fA0 1cM0 3Co0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 8Hz0|10e5",
		"Europe/Warsaw|WMT CET CEST EET EEST|-1o -10 -20 -20 -30|012121234312121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121|-2ctdo 1LXo 11d0 1iO0 11A0 1o00 11A0 1on0 11A0 6zy0 HWP0 5IM0 WM0 1fA0 1cM0 1dz0 1mL0 1en0 15B0 1aq0 1nA0 11A0 1io0 17c0 1fA0 1a00 iDX0 LA0 1cM0 1cM0 1C00 Oo0 1cM0 1cM0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1C00 LA0 uso0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cN0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|17e5",
		"Europe/Zaporozhye|+0220 EET MSK CEST CET MSD EEST|-2k -20 -30 -20 -10 -40 -30|01234342525252525252525252526161616161616161616161616161616161616161616161616161616161616161616161616161616161616161616161|-1Pc2k eUok rdb0 2RE0 WM0 1fA0 8m0 1v9a0 1db0 1cN0 1db0 1cN0 1db0 1dd0 1cO0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cK0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cQ0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00|77e4",
		"HST|HST|a0|0|",
		"Indian/Chagos|LMT +05 +06|-4N.E -50 -60|012|-2xosN.E 3AGLN.E|30e2",
		"Indian/Cocos|+0630|-6u|0||596",
		"Indian/Kerguelen|-00 +05|0 -50|01|-MG00|130",
		"Indian/Mahe|LMT +04|-3F.M -40|01|-2yO3F.M|79e3",
		"Indian/Maldives|MMT +05|-4S -50|01|-olgS|35e4",
		"Indian/Mauritius|LMT +04 +05|-3O -40 -50|012121|-2xorO 34unO 14L0 12kr0 11z0|15e4",
		"Indian/Reunion|LMT +04|-3F.Q -40|01|-2mDDF.Q|84e4",
		"Pacific/Kwajalein|+11 -12 +12|-b0 c0 -c0|012|-AX0 W9X0|14e3",
		"MET|MET MEST|-10 -20|01010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-2aFe0 11d0 1iO0 11A0 1o00 11A0 Qrc0 6i00 WM0 1fA0 1cM0 1cM0 1cM0 16M0 1gMM0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00",
		"MST|MST|70|0|",
		"MST7MDT|MST MDT MWT MPT|70 60 60 60|010102301010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-261r0 1nX0 11B0 1nX0 SgN0 8x20 ix0 QwN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"Pacific/Chatham|+1215 +1245 +1345|-cf -cJ -dJ|012121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212121212|-WqAf 1adef IM0 1C00 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Oo0 1zc0 Rc0 1zc0 Oo0 1qM0 14o0 1lc0 14o0 1lc0 14o0 1lc0 17c0 1io0 17c0 1io0 17c0 1io0 17c0 1lc0 14o0 1lc0 14o0 1lc0 17c0 1io0 17c0 1io0 17c0 1lc0 14o0 1lc0 14o0 1lc0 17c0 1io0 17c0 1io0 17c0 1io0 17c0 1io0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00|600",
		"PST8PDT|PST PDT PWT PPT|80 70 70 70|010102301010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|-261q0 1nX0 11B0 1nX0 SgN0 8x10 iy0 QwN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1cN0 1cL0 1cN0 1cL0 s10 1Vz0 LB0 1BX0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1fz0 1a10 1fz0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 14p0 1lb0 14p0 1lb0 14p0 1nX0 11B0 1nX0 11B0 1nX0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Rd0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0 Op0 1zb0",
		"Pacific/Apia|LMT -1130 -11 -10 +14 +13|bq.U bu b0 a0 -e0 -d0|01232345454545454545454545454545454545454545454545454545454|-2nDMx.4 1yW03.4 2rRbu 1ff0 1a00 CI0 AQ0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1io0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1a00 1fA0 1cM0 1fA0 1a00 1fA0 1a00|37e3",
		"Pacific/Bougainville|+10 +09 +11|-a0 -90 -b0|0102|-16Wy0 7CN0 2MQp0|18e4",
		"Pacific/Efate|LMT +11 +12|-bd.g -b0 -c0|0121212121212121212121|-2l9nd.g 2Szcd.g 1cL0 1oN0 10L0 1fB0 19X0 1fB0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1cN0 1cL0 1fB0 Lz0 1Nd0 An0|66e3",
		"Pacific/Enderbury|-12 -11 +13|c0 b0 -d0|012|nIc0 B8n0|1",
		"Pacific/Fakaofo|-11 +13|b0 -d0|01|1Gfn0|483",
		"Pacific/Fiji|LMT +12 +13|-bT.I -c0 -d0|0121212121212121212121212121212121212121212121212121212121212121|-2bUzT.I 3m8NT.I LA0 1EM0 IM0 nJc0 LA0 1o00 Rc0 1wo0 Ao0 1Nc0 Ao0 1Q00 xz0 1SN0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 uM0 1SM0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 s00 1VA0 uM0 1SM0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 uM0 1SM0 uM0 1SM0 uM0 1VA0 s00 1VA0 s00 1VA0 s00 1VA0 uM0 1SM0 uM0 1SM0 uM0|88e4",
		"Pacific/Galapagos|LMT -05 -06|5W.o 50 60|01212|-1yVS1.A 2dTz1.A gNd0 rz0|25e3",
		"Pacific/Gambier|LMT -09|8X.M 90|01|-2jof0.c|125",
		"Pacific/Guadalcanal|LMT +11|-aD.M -b0|01|-2joyD.M|11e4",
		"Pacific/Guam|GST ChST|-a0 -a0|01|1fpq0|17e4",
		"Pacific/Honolulu|HST HDT HST|au 9u a0|010102|-1thLu 8x0 lef0 8Pz0 46p0|37e4",
		"Pacific/Kiritimati|-1040 -10 +14|aE a0 -e0|012|nIaE B8nk|51e2",
		"Pacific/Kosrae|+11 +12|-b0 -c0|010|-AX0 1bdz0|66e2",
		"Pacific/Majuro|+11 +12|-b0 -c0|01|-AX0|28e3",
		"Pacific/Marquesas|LMT -0930|9i 9u|01|-2joeG|86e2",
		"Pacific/Pago_Pago|LMT SST|bm.M b0|01|-2nDMB.c|37e2",
		"Pacific/Nauru|LMT +1130 +09 +12|-b7.E -bu -90 -c0|01213|-1Xdn7.E PvzB.E 5RCu 1ouJu|10e3",
		"Pacific/Niue|-1120 -1130 -11|bk bu b0|012|-KfME 17y0a|12e2",
		"Pacific/Norfolk|+1112 +1130 +1230 +11|-bc -bu -cu -b0|01213|-Kgbc W01G On0 1COp0|25e4",
		"Pacific/Noumea|LMT +11 +12|-b5.M -b0 -c0|01212121|-2l9n5.M 2EqM5.M xX0 1PB0 yn0 HeP0 Ao0|98e3",
		"Pacific/Pitcairn|-0830 -08|8u 80|01|18Vku|56",
		"Pacific/Rarotonga|-1030 -0930 -10|au 9u a0|012121212121212121212121212|lyWu IL0 1zcu Onu 1zcu Onu 1zcu Rbu 1zcu Onu 1zcu Onu 1zcu Onu 1zcu Onu 1zcu Onu 1zcu Rbu 1zcu Onu 1zcu Onu 1zcu Onu|13e3",
		"Pacific/Tahiti|LMT -10|9W.g a0|01|-2joe1.I|18e4",
		"Pacific/Tongatapu|+1220 +13 +14|-ck -d0 -e0|0121212121|-1aB0k 2n5dk 15A0 1wo0 xz0 1Q10 xz0 zWN0 s00|75e3",
		"WET|WET WEST|0 -10|010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010|hDB0 1a00 1fA0 1cM0 1cM0 1cM0 1fA0 1a00 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1cM0 1fA0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00 11A0 1qM0 WM0 1qM0 WM0 1qM0 WM0 1qM0 11A0 1o00 11A0 1o00"
	],
	"links": [
		"Africa/Abidjan|Africa/Bamako",
		"Africa/Abidjan|Africa/Banjul",
		"Africa/Abidjan|Africa/Conakry",
		"Africa/Abidjan|Africa/Dakar",
		"Africa/Abidjan|Africa/Freetown",
		"Africa/Abidjan|Africa/Lome",
		"Africa/Abidjan|Africa/Nouakchott",
		"Africa/Abidjan|Africa/Ouagadougou",
		"Africa/Abidjan|Africa/Sao_Tome",
		"Africa/Abidjan|Africa/Timbuktu",
		"Africa/Abidjan|Atlantic/St_Helena",
		"Africa/Cairo|Egypt",
		"Africa/Johannesburg|Africa/Maseru",
		"Africa/Johannesburg|Africa/Mbabane",
		"Africa/Lagos|Africa/Bangui",
		"Africa/Lagos|Africa/Brazzaville",
		"Africa/Lagos|Africa/Douala",
		"Africa/Lagos|Africa/Kinshasa",
		"Africa/Lagos|Africa/Libreville",
		"Africa/Lagos|Africa/Luanda",
		"Africa/Lagos|Africa/Malabo",
		"Africa/Lagos|Africa/Niamey",
		"Africa/Lagos|Africa/Porto-Novo",
		"Africa/Maputo|Africa/Blantyre",
		"Africa/Maputo|Africa/Bujumbura",
		"Africa/Maputo|Africa/Gaborone",
		"Africa/Maputo|Africa/Harare",
		"Africa/Maputo|Africa/Kigali",
		"Africa/Maputo|Africa/Lubumbashi",
		"Africa/Maputo|Africa/Lusaka",
		"Africa/Nairobi|Africa/Addis_Ababa",
		"Africa/Nairobi|Africa/Asmara",
		"Africa/Nairobi|Africa/Asmera",
		"Africa/Nairobi|Africa/Dar_es_Salaam",
		"Africa/Nairobi|Africa/Djibouti",
		"Africa/Nairobi|Africa/Kampala",
		"Africa/Nairobi|Africa/Mogadishu",
		"Africa/Nairobi|Indian/Antananarivo",
		"Africa/Nairobi|Indian/Comoro",
		"Africa/Nairobi|Indian/Mayotte",
		"Africa/Tripoli|Libya",
		"America/Adak|America/Atka",
		"America/Adak|US/Aleutian",
		"America/Anchorage|US/Alaska",
		"America/Argentina/Buenos_Aires|America/Buenos_Aires",
		"America/Argentina/Catamarca|America/Argentina/ComodRivadavia",
		"America/Argentina/Catamarca|America/Catamarca",
		"America/Argentina/Cordoba|America/Cordoba",
		"America/Argentina/Cordoba|America/Rosario",
		"America/Argentina/Jujuy|America/Jujuy",
		"America/Argentina/Mendoza|America/Mendoza",
		"America/Atikokan|America/Coral_Harbour",
		"America/Chicago|US/Central",
		"America/Curacao|America/Aruba",
		"America/Curacao|America/Kralendijk",
		"America/Curacao|America/Lower_Princes",
		"America/Denver|America/Shiprock",
		"America/Denver|Navajo",
		"America/Denver|US/Mountain",
		"America/Detroit|US/Michigan",
		"America/Edmonton|Canada/Mountain",
		"America/Fort_Wayne|America/Indiana/Indianapolis",
		"America/Fort_Wayne|America/Indianapolis",
		"America/Fort_Wayne|US/East-Indiana",
		"America/Halifax|Canada/Atlantic",
		"America/Havana|Cuba",
		"America/Indiana/Knox|America/Knox_IN",
		"America/Indiana/Knox|US/Indiana-Starke",
		"America/Jamaica|Jamaica",
		"America/Kentucky/Louisville|America/Louisville",
		"America/Los_Angeles|US/Pacific",
		"America/Los_Angeles|US/Pacific-New",
		"America/Manaus|Brazil/West",
		"America/Mazatlan|Mexico/BajaSur",
		"America/Mexico_City|Mexico/General",
		"America/New_York|US/Eastern",
		"America/Noronha|Brazil/DeNoronha",
		"America/Panama|America/Cayman",
		"America/Phoenix|US/Arizona",
		"America/Port_of_Spain|America/Anguilla",
		"America/Port_of_Spain|America/Antigua",
		"America/Port_of_Spain|America/Dominica",
		"America/Port_of_Spain|America/Grenada",
		"America/Port_of_Spain|America/Guadeloupe",
		"America/Port_of_Spain|America/Marigot",
		"America/Port_of_Spain|America/Montserrat",
		"America/Port_of_Spain|America/St_Barthelemy",
		"America/Port_of_Spain|America/St_Kitts",
		"America/Port_of_Spain|America/St_Lucia",
		"America/Port_of_Spain|America/St_Thomas",
		"America/Port_of_Spain|America/St_Vincent",
		"America/Port_of_Spain|America/Tortola",
		"America/Port_of_Spain|America/Virgin",
		"America/Regina|Canada/Saskatchewan",
		"America/Rio_Branco|America/Porto_Acre",
		"America/Rio_Branco|Brazil/Acre",
		"America/Santiago|Chile/Continental",
		"America/Sao_Paulo|Brazil/East",
		"America/St_Johns|Canada/Newfoundland",
		"America/Tijuana|America/Ensenada",
		"America/Tijuana|America/Santa_Isabel",
		"America/Tijuana|Mexico/BajaNorte",
		"America/Toronto|America/Montreal",
		"America/Toronto|Canada/Eastern",
		"America/Vancouver|Canada/Pacific",
		"America/Whitehorse|Canada/Yukon",
		"America/Winnipeg|Canada/Central",
		"Asia/Ashgabat|Asia/Ashkhabad",
		"Asia/Bangkok|Asia/Phnom_Penh",
		"Asia/Bangkok|Asia/Vientiane",
		"Asia/Dhaka|Asia/Dacca",
		"Asia/Dubai|Asia/Muscat",
		"Asia/Ho_Chi_Minh|Asia/Saigon",
		"Asia/Hong_Kong|Hongkong",
		"Asia/Jerusalem|Asia/Tel_Aviv",
		"Asia/Jerusalem|Israel",
		"Asia/Kathmandu|Asia/Katmandu",
		"Asia/Kolkata|Asia/Calcutta",
		"Asia/Kuala_Lumpur|Asia/Singapore",
		"Asia/Kuala_Lumpur|Singapore",
		"Asia/Macau|Asia/Macao",
		"Asia/Makassar|Asia/Ujung_Pandang",
		"Asia/Nicosia|Europe/Nicosia",
		"Asia/Qatar|Asia/Bahrain",
		"Asia/Rangoon|Asia/Yangon",
		"Asia/Riyadh|Asia/Aden",
		"Asia/Riyadh|Asia/Kuwait",
		"Asia/Seoul|ROK",
		"Asia/Shanghai|Asia/Chongqing",
		"Asia/Shanghai|Asia/Chungking",
		"Asia/Shanghai|Asia/Harbin",
		"Asia/Shanghai|PRC",
		"Asia/Taipei|ROC",
		"Asia/Tehran|Iran",
		"Asia/Thimphu|Asia/Thimbu",
		"Asia/Tokyo|Japan",
		"Asia/Ulaanbaatar|Asia/Ulan_Bator",
		"Asia/Urumqi|Asia/Kashgar",
		"Atlantic/Faroe|Atlantic/Faeroe",
		"Atlantic/Reykjavik|Iceland",
		"Atlantic/South_Georgia|Etc/GMT+2",
		"Australia/Adelaide|Australia/South",
		"Australia/Brisbane|Australia/Queensland",
		"Australia/Broken_Hill|Australia/Yancowinna",
		"Australia/Darwin|Australia/North",
		"Australia/Hobart|Australia/Tasmania",
		"Australia/Lord_Howe|Australia/LHI",
		"Australia/Melbourne|Australia/Victoria",
		"Australia/Perth|Australia/West",
		"Australia/Sydney|Australia/ACT",
		"Australia/Sydney|Australia/Canberra",
		"Australia/Sydney|Australia/NSW",
		"Etc/GMT+0|Etc/GMT",
		"Etc/GMT+0|Etc/GMT-0",
		"Etc/GMT+0|Etc/GMT0",
		"Etc/GMT+0|Etc/Greenwich",
		"Etc/GMT+0|GMT",
		"Etc/GMT+0|GMT+0",
		"Etc/GMT+0|GMT-0",
		"Etc/GMT+0|GMT0",
		"Etc/GMT+0|Greenwich",
		"Etc/UCT|UCT",
		"Etc/UTC|Etc/Universal",
		"Etc/UTC|Etc/Zulu",
		"Etc/UTC|UTC",
		"Etc/UTC|Universal",
		"Etc/UTC|Zulu",
		"Europe/Belgrade|Europe/Ljubljana",
		"Europe/Belgrade|Europe/Podgorica",
		"Europe/Belgrade|Europe/Sarajevo",
		"Europe/Belgrade|Europe/Skopje",
		"Europe/Belgrade|Europe/Zagreb",
		"Europe/Chisinau|Europe/Tiraspol",
		"Europe/Dublin|Eire",
		"Europe/Helsinki|Europe/Mariehamn",
		"Europe/Istanbul|Asia/Istanbul",
		"Europe/Istanbul|Turkey",
		"Europe/Lisbon|Portugal",
		"Europe/London|Europe/Belfast",
		"Europe/London|Europe/Guernsey",
		"Europe/London|Europe/Isle_of_Man",
		"Europe/London|Europe/Jersey",
		"Europe/London|GB",
		"Europe/London|GB-Eire",
		"Europe/Moscow|W-SU",
		"Europe/Oslo|Arctic/Longyearbyen",
		"Europe/Oslo|Atlantic/Jan_Mayen",
		"Europe/Prague|Europe/Bratislava",
		"Europe/Rome|Europe/San_Marino",
		"Europe/Rome|Europe/Vatican",
		"Europe/Warsaw|Poland",
		"Europe/Zurich|Europe/Busingen",
		"Europe/Zurich|Europe/Vaduz",
		"Indian/Christmas|Etc/GMT-7",
		"Pacific/Auckland|Antarctica/McMurdo",
		"Pacific/Auckland|Antarctica/South_Pole",
		"Pacific/Auckland|NZ",
		"Pacific/Chatham|NZ-CHAT",
		"Pacific/Easter|Chile/EasterIsland",
		"Pacific/Guam|Pacific/Saipan",
		"Pacific/Honolulu|Pacific/Johnston",
		"Pacific/Honolulu|US/Hawaii",
		"Pacific/Kwajalein|Kwajalein",
		"Pacific/Pago_Pago|Pacific/Midway",
		"Pacific/Pago_Pago|Pacific/Samoa",
		"Pacific/Pago_Pago|US/Samoa",
		"Pacific/Palau|Etc/GMT-9",
		"Pacific/Pohnpei|Etc/GMT-11",
		"Pacific/Pohnpei|Pacific/Ponape",
		"Pacific/Port_Moresby|Etc/GMT-10",
		"Pacific/Port_Moresby|Pacific/Chuuk",
		"Pacific/Port_Moresby|Pacific/Truk",
		"Pacific/Port_Moresby|Pacific/Yap",
		"Pacific/Tarawa|Etc/GMT-12",
		"Pacific/Tarawa|Pacific/Funafuti",
		"Pacific/Tarawa|Pacific/Wake",
		"Pacific/Tarawa|Pacific/Wallis"
	]
}
},{}],14:[function(require,module,exports){
var moment = module.exports = require("./moment-timezone");
moment.tz.load(require('./data/packed/latest.json'));

},{"./data/packed/latest.json":13,"./moment-timezone":15}],15:[function(require,module,exports){
//! moment-timezone.js
//! version : 0.5.14
//! Copyright (c) JS Foundation and other contributors
//! license : MIT
//! github.com/moment/moment-timezone

(function (root, factory) {
	"use strict";

	/*global define*/
	if (typeof define === 'function' && define.amd) {
		define(['moment'], factory);                 // AMD
	} else if (typeof module === 'object' && module.exports) {
		module.exports = factory(require('moment')); // Node
	} else {
		factory(root.moment);                        // Browser
	}
}(this, function (moment) {
	"use strict";

	// Do not load moment-timezone a second time.
	// if (moment.tz !== undefined) {
	// 	logError('Moment Timezone ' + moment.tz.version + ' was already loaded ' + (moment.tz.dataVersion ? 'with data from ' : 'without any data') + moment.tz.dataVersion);
	// 	return moment;
	// }

	var VERSION = "0.5.14",
		zones = {},
		links = {},
		names = {},
		guesses = {},
		cachedGuess,

		momentVersion = moment.version.split('.'),
		major = +momentVersion[0],
		minor = +momentVersion[1];

	// Moment.js version check
	if (major < 2 || (major === 2 && minor < 6)) {
		logError('Moment Timezone requires Moment.js >= 2.6.0. You are using Moment.js ' + moment.version + '. See momentjs.com');
	}

	/************************************
		Unpacking
	************************************/

	function charCodeToInt(charCode) {
		if (charCode > 96) {
			return charCode - 87;
		} else if (charCode > 64) {
			return charCode - 29;
		}
		return charCode - 48;
	}

	function unpackBase60(string) {
		var i = 0,
			parts = string.split('.'),
			whole = parts[0],
			fractional = parts[1] || '',
			multiplier = 1,
			num,
			out = 0,
			sign = 1;

		// handle negative numbers
		if (string.charCodeAt(0) === 45) {
			i = 1;
			sign = -1;
		}

		// handle digits before the decimal
		for (i; i < whole.length; i++) {
			num = charCodeToInt(whole.charCodeAt(i));
			out = 60 * out + num;
		}

		// handle digits after the decimal
		for (i = 0; i < fractional.length; i++) {
			multiplier = multiplier / 60;
			num = charCodeToInt(fractional.charCodeAt(i));
			out += num * multiplier;
		}

		return out * sign;
	}

	function arrayToInt (array) {
		for (var i = 0; i < array.length; i++) {
			array[i] = unpackBase60(array[i]);
		}
	}

	function intToUntil (array, length) {
		for (var i = 0; i < length; i++) {
			array[i] = Math.round((array[i - 1] || 0) + (array[i] * 60000)); // minutes to milliseconds
		}

		array[length - 1] = Infinity;
	}

	function mapIndices (source, indices) {
		var out = [], i;

		for (i = 0; i < indices.length; i++) {
			out[i] = source[indices[i]];
		}

		return out;
	}

	function unpack (string) {
		var data = string.split('|'),
			offsets = data[2].split(' '),
			indices = data[3].split(''),
			untils  = data[4].split(' ');

		arrayToInt(offsets);
		arrayToInt(indices);
		arrayToInt(untils);

		intToUntil(untils, indices.length);

		return {
			name       : data[0],
			abbrs      : mapIndices(data[1].split(' '), indices),
			offsets    : mapIndices(offsets, indices),
			untils     : untils,
			population : data[5] | 0
		};
	}

	/************************************
		Zone object
	************************************/

	function Zone (packedString) {
		if (packedString) {
			this._set(unpack(packedString));
		}
	}

	Zone.prototype = {
		_set : function (unpacked) {
			this.name       = unpacked.name;
			this.abbrs      = unpacked.abbrs;
			this.untils     = unpacked.untils;
			this.offsets    = unpacked.offsets;
			this.population = unpacked.population;
		},

		_index : function (timestamp) {
			var target = +timestamp,
				untils = this.untils,
				i;

			for (i = 0; i < untils.length; i++) {
				if (target < untils[i]) {
					return i;
				}
			}
		},

		parse : function (timestamp) {
			var target  = +timestamp,
				offsets = this.offsets,
				untils  = this.untils,
				max     = untils.length - 1,
				offset, offsetNext, offsetPrev, i;

			for (i = 0; i < max; i++) {
				offset     = offsets[i];
				offsetNext = offsets[i + 1];
				offsetPrev = offsets[i ? i - 1 : i];

				if (offset < offsetNext && tz.moveAmbiguousForward) {
					offset = offsetNext;
				} else if (offset > offsetPrev && tz.moveInvalidForward) {
					offset = offsetPrev;
				}

				if (target < untils[i] - (offset * 60000)) {
					return offsets[i];
				}
			}

			return offsets[max];
		},

		abbr : function (mom) {
			return this.abbrs[this._index(mom)];
		},

		offset : function (mom) {
			logError("zone.offset has been deprecated in favor of zone.utcOffset");
			return this.offsets[this._index(mom)];
		},

		utcOffset : function (mom) {
			return this.offsets[this._index(mom)];
		}
	};

	/************************************
		Current Timezone
	************************************/

	function OffsetAt(at) {
		var timeString = at.toTimeString();
		var abbr = timeString.match(/\([a-z ]+\)/i);
		if (abbr && abbr[0]) {
			// 17:56:31 GMT-0600 (CST)
			// 17:56:31 GMT-0600 (Central Standard Time)
			abbr = abbr[0].match(/[A-Z]/g);
			abbr = abbr ? abbr.join('') : undefined;
		} else {
			// 17:56:31 CST
			// 17:56:31 GMT+0800 (台北標準時間)
			abbr = timeString.match(/[A-Z]{3,5}/g);
			abbr = abbr ? abbr[0] : undefined;
		}

		if (abbr === 'GMT') {
			abbr = undefined;
		}

		this.at = +at;
		this.abbr = abbr;
		this.offset = at.getTimezoneOffset();
	}

	function ZoneScore(zone) {
		this.zone = zone;
		this.offsetScore = 0;
		this.abbrScore = 0;
	}

	ZoneScore.prototype.scoreOffsetAt = function (offsetAt) {
		this.offsetScore += Math.abs(this.zone.utcOffset(offsetAt.at) - offsetAt.offset);
		if (this.zone.abbr(offsetAt.at).replace(/[^A-Z]/g, '') !== offsetAt.abbr) {
			this.abbrScore++;
		}
	};

	function findChange(low, high) {
		var mid, diff;

		while ((diff = ((high.at - low.at) / 12e4 | 0) * 6e4)) {
			mid = new OffsetAt(new Date(low.at + diff));
			if (mid.offset === low.offset) {
				low = mid;
			} else {
				high = mid;
			}
		}

		return low;
	}

	function userOffsets() {
		var startYear = new Date().getFullYear() - 2,
			last = new OffsetAt(new Date(startYear, 0, 1)),
			offsets = [last],
			change, next, i;

		for (i = 1; i < 48; i++) {
			next = new OffsetAt(new Date(startYear, i, 1));
			if (next.offset !== last.offset) {
				change = findChange(last, next);
				offsets.push(change);
				offsets.push(new OffsetAt(new Date(change.at + 6e4)));
			}
			last = next;
		}

		for (i = 0; i < 4; i++) {
			offsets.push(new OffsetAt(new Date(startYear + i, 0, 1)));
			offsets.push(new OffsetAt(new Date(startYear + i, 6, 1)));
		}

		return offsets;
	}

	function sortZoneScores (a, b) {
		if (a.offsetScore !== b.offsetScore) {
			return a.offsetScore - b.offsetScore;
		}
		if (a.abbrScore !== b.abbrScore) {
			return a.abbrScore - b.abbrScore;
		}
		return b.zone.population - a.zone.population;
	}

	function addToGuesses (name, offsets) {
		var i, offset;
		arrayToInt(offsets);
		for (i = 0; i < offsets.length; i++) {
			offset = offsets[i];
			guesses[offset] = guesses[offset] || {};
			guesses[offset][name] = true;
		}
	}

	function guessesForUserOffsets (offsets) {
		var offsetsLength = offsets.length,
			filteredGuesses = {},
			out = [],
			i, j, guessesOffset;

		for (i = 0; i < offsetsLength; i++) {
			guessesOffset = guesses[offsets[i].offset] || {};
			for (j in guessesOffset) {
				if (guessesOffset.hasOwnProperty(j)) {
					filteredGuesses[j] = true;
				}
			}
		}

		for (i in filteredGuesses) {
			if (filteredGuesses.hasOwnProperty(i)) {
				out.push(names[i]);
			}
		}

		return out;
	}

	function rebuildGuess () {

		// use Intl API when available and returning valid time zone
		try {
			var intlName = Intl.DateTimeFormat().resolvedOptions().timeZone;
			if (intlName && intlName.length > 3) {
				var name = names[normalizeName(intlName)];
				if (name) {
					return name;
				}
				logError("Moment Timezone found " + intlName + " from the Intl api, but did not have that data loaded.");
			}
		} catch (e) {
			// Intl unavailable, fall back to manual guessing.
		}

		var offsets = userOffsets(),
			offsetsLength = offsets.length,
			guesses = guessesForUserOffsets(offsets),
			zoneScores = [],
			zoneScore, i, j;

		for (i = 0; i < guesses.length; i++) {
			zoneScore = new ZoneScore(getZone(guesses[i]), offsetsLength);
			for (j = 0; j < offsetsLength; j++) {
				zoneScore.scoreOffsetAt(offsets[j]);
			}
			zoneScores.push(zoneScore);
		}

		zoneScores.sort(sortZoneScores);

		return zoneScores.length > 0 ? zoneScores[0].zone.name : undefined;
	}

	function guess (ignoreCache) {
		if (!cachedGuess || ignoreCache) {
			cachedGuess = rebuildGuess();
		}
		return cachedGuess;
	}

	/************************************
		Global Methods
	************************************/

	function normalizeName (name) {
		return (name || '').toLowerCase().replace(/\//g, '_');
	}

	function addZone (packed) {
		var i, name, split, normalized;

		if (typeof packed === "string") {
			packed = [packed];
		}

		for (i = 0; i < packed.length; i++) {
			split = packed[i].split('|');
			name = split[0];
			normalized = normalizeName(name);
			zones[normalized] = packed[i];
			names[normalized] = name;
			addToGuesses(normalized, split[2].split(' '));
		}
	}

	function getZone (name, caller) {
		name = normalizeName(name);

		var zone = zones[name];
		var link;

		if (zone instanceof Zone) {
			return zone;
		}

		if (typeof zone === 'string') {
			zone = new Zone(zone);
			zones[name] = zone;
			return zone;
		}

		// Pass getZone to prevent recursion more than 1 level deep
		if (links[name] && caller !== getZone && (link = getZone(links[name], getZone))) {
			zone = zones[name] = new Zone();
			zone._set(link);
			zone.name = names[name];
			return zone;
		}

		return null;
	}

	function getNames () {
		var i, out = [];

		for (i in names) {
			if (names.hasOwnProperty(i) && (zones[i] || zones[links[i]]) && names[i]) {
				out.push(names[i]);
			}
		}

		return out.sort();
	}

	function addLink (aliases) {
		var i, alias, normal0, normal1;

		if (typeof aliases === "string") {
			aliases = [aliases];
		}

		for (i = 0; i < aliases.length; i++) {
			alias = aliases[i].split('|');

			normal0 = normalizeName(alias[0]);
			normal1 = normalizeName(alias[1]);

			links[normal0] = normal1;
			names[normal0] = alias[0];

			links[normal1] = normal0;
			names[normal1] = alias[1];
		}
	}

	function loadData (data) {
		addZone(data.zones);
		addLink(data.links);
		tz.dataVersion = data.version;
	}

	function zoneExists (name) {
		if (!zoneExists.didShowError) {
			zoneExists.didShowError = true;
				logError("moment.tz.zoneExists('" + name + "') has been deprecated in favor of !moment.tz.zone('" + name + "')");
		}
		return !!getZone(name);
	}

	function needsOffset (m) {
		var isUnixTimestamp = (m._f === 'X' || m._f === 'x');
		return !!(m._a && (m._tzm === undefined) && !isUnixTimestamp);
	}

	function logError (message) {
		if (typeof console !== 'undefined' && typeof console.error === 'function') {
			console.error(message);
		}
	}

	/************************************
		moment.tz namespace
	************************************/

	function tz (input) {
		var args = Array.prototype.slice.call(arguments, 0, -1),
			name = arguments[arguments.length - 1],
			zone = getZone(name),
			out  = moment.utc.apply(null, args);

		if (zone && !moment.isMoment(input) && needsOffset(out)) {
			out.add(zone.parse(out), 'minutes');
		}

		out.tz(name);

		return out;
	}

	tz.version      = VERSION;
	tz.dataVersion  = '';
	tz._zones       = zones;
	tz._links       = links;
	tz._names       = names;
	tz.add          = addZone;
	tz.link         = addLink;
	tz.load         = loadData;
	tz.zone         = getZone;
	tz.zoneExists   = zoneExists; // deprecated in 0.1.0
	tz.guess        = guess;
	tz.names        = getNames;
	tz.Zone         = Zone;
	tz.unpack       = unpack;
	tz.unpackBase60 = unpackBase60;
	tz.needsOffset  = needsOffset;
	tz.moveInvalidForward   = true;
	tz.moveAmbiguousForward = false;

	/************************************
		Interface with Moment.js
	************************************/

	var fn = moment.fn;

	moment.tz = tz;

	moment.defaultZone = null;

	moment.updateOffset = function (mom, keepTime) {
		var zone = moment.defaultZone,
			offset;

		if (mom._z === undefined) {
			if (zone && needsOffset(mom) && !mom._isUTC) {
				mom._d = moment.utc(mom._a)._d;
				mom.utc().add(zone.parse(mom), 'minutes');
			}
			mom._z = zone;
		}
		if (mom._z) {
			offset = mom._z.utcOffset(mom);
			if (Math.abs(offset) < 16) {
				offset = offset / 60;
			}
			if (mom.utcOffset !== undefined) {
				mom.utcOffset(-offset, keepTime);
			} else {
				mom.zone(offset, keepTime);
			}
		}
	};

	fn.tz = function (name, keepTime) {
		if (name) {
			this._z = getZone(name);
			if (this._z) {
				moment.updateOffset(this, keepTime);
			} else {
				logError("Moment Timezone has no data for " + name + ". See http://momentjs.com/timezone/docs/#/data-loading/.");
			}
			return this;
		}
		if (this._z) { return this._z.name; }
	};

	function abbrWrap (old) {
		return function () {
			if (this._z) { return this._z.abbr(this); }
			return old.call(this);
		};
	}

	function resetZoneWrap (old) {
		return function () {
			this._z = null;
			return old.apply(this, arguments);
		};
	}

	fn.zoneName = abbrWrap(fn.zoneName);
	fn.zoneAbbr = abbrWrap(fn.zoneAbbr);
	fn.utc      = resetZoneWrap(fn.utc);

	moment.tz.setDefault = function(name) {
		if (major < 2 || (major === 2 && minor < 9)) {
			logError('Moment Timezone setDefault() requires Moment.js >= 2.9.0. You are using Moment.js ' + moment.version + '.');
		}
		moment.defaultZone = name ? getZone(name) : null;
		return moment;
	};

	// Cloning a moment should include the _z property.
	var momentProperties = moment.momentProperties;
	if (Object.prototype.toString.call(momentProperties) === '[object Array]') {
		// moment 2.8.1+
		momentProperties.push('_z');
		momentProperties.push('_a');
	} else if (momentProperties) {
		// moment 2.7.0
		momentProperties._z = null;
	}

	// INJECT DATA

	return moment;
}));

},{"moment":16}],16:[function(require,module,exports){
//! moment.js

;(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    global.moment = factory()
}(this, (function () { 'use strict';

var hookCallback;

function hooks () {
    return hookCallback.apply(null, arguments);
}

// This is done to register the method called with moment()
// without creating circular dependencies.
function setHookCallback (callback) {
    hookCallback = callback;
}

function isArray(input) {
    return input instanceof Array || Object.prototype.toString.call(input) === '[object Array]';
}

function isObject(input) {
    // IE8 will treat undefined and null as object if it wasn't for
    // input != null
    return input != null && Object.prototype.toString.call(input) === '[object Object]';
}

function isObjectEmpty(obj) {
    if (Object.getOwnPropertyNames) {
        return (Object.getOwnPropertyNames(obj).length === 0);
    } else {
        var k;
        for (k in obj) {
            if (obj.hasOwnProperty(k)) {
                return false;
            }
        }
        return true;
    }
}

function isUndefined(input) {
    return input === void 0;
}

function isNumber(input) {
    return typeof input === 'number' || Object.prototype.toString.call(input) === '[object Number]';
}

function isDate(input) {
    return input instanceof Date || Object.prototype.toString.call(input) === '[object Date]';
}

function map(arr, fn) {
    var res = [], i;
    for (i = 0; i < arr.length; ++i) {
        res.push(fn(arr[i], i));
    }
    return res;
}

function hasOwnProp(a, b) {
    return Object.prototype.hasOwnProperty.call(a, b);
}

function extend(a, b) {
    for (var i in b) {
        if (hasOwnProp(b, i)) {
            a[i] = b[i];
        }
    }

    if (hasOwnProp(b, 'toString')) {
        a.toString = b.toString;
    }

    if (hasOwnProp(b, 'valueOf')) {
        a.valueOf = b.valueOf;
    }

    return a;
}

function createUTC (input, format, locale, strict) {
    return createLocalOrUTC(input, format, locale, strict, true).utc();
}

function defaultParsingFlags() {
    // We need to deep clone this object.
    return {
        empty           : false,
        unusedTokens    : [],
        unusedInput     : [],
        overflow        : -2,
        charsLeftOver   : 0,
        nullInput       : false,
        invalidMonth    : null,
        invalidFormat   : false,
        userInvalidated : false,
        iso             : false,
        parsedDateParts : [],
        meridiem        : null,
        rfc2822         : false,
        weekdayMismatch : false
    };
}

function getParsingFlags(m) {
    if (m._pf == null) {
        m._pf = defaultParsingFlags();
    }
    return m._pf;
}

var some;
if (Array.prototype.some) {
    some = Array.prototype.some;
} else {
    some = function (fun) {
        var t = Object(this);
        var len = t.length >>> 0;

        for (var i = 0; i < len; i++) {
            if (i in t && fun.call(this, t[i], i, t)) {
                return true;
            }
        }

        return false;
    };
}

function isValid(m) {
    if (m._isValid == null) {
        var flags = getParsingFlags(m);
        var parsedParts = some.call(flags.parsedDateParts, function (i) {
            return i != null;
        });
        var isNowValid = !isNaN(m._d.getTime()) &&
            flags.overflow < 0 &&
            !flags.empty &&
            !flags.invalidMonth &&
            !flags.invalidWeekday &&
            !flags.weekdayMismatch &&
            !flags.nullInput &&
            !flags.invalidFormat &&
            !flags.userInvalidated &&
            (!flags.meridiem || (flags.meridiem && parsedParts));

        if (m._strict) {
            isNowValid = isNowValid &&
                flags.charsLeftOver === 0 &&
                flags.unusedTokens.length === 0 &&
                flags.bigHour === undefined;
        }

        if (Object.isFrozen == null || !Object.isFrozen(m)) {
            m._isValid = isNowValid;
        }
        else {
            return isNowValid;
        }
    }
    return m._isValid;
}

function createInvalid (flags) {
    var m = createUTC(NaN);
    if (flags != null) {
        extend(getParsingFlags(m), flags);
    }
    else {
        getParsingFlags(m).userInvalidated = true;
    }

    return m;
}

// Plugins that add properties should also add the key here (null value),
// so we can properly clone ourselves.
var momentProperties = hooks.momentProperties = [];

function copyConfig(to, from) {
    var i, prop, val;

    if (!isUndefined(from._isAMomentObject)) {
        to._isAMomentObject = from._isAMomentObject;
    }
    if (!isUndefined(from._i)) {
        to._i = from._i;
    }
    if (!isUndefined(from._f)) {
        to._f = from._f;
    }
    if (!isUndefined(from._l)) {
        to._l = from._l;
    }
    if (!isUndefined(from._strict)) {
        to._strict = from._strict;
    }
    if (!isUndefined(from._tzm)) {
        to._tzm = from._tzm;
    }
    if (!isUndefined(from._isUTC)) {
        to._isUTC = from._isUTC;
    }
    if (!isUndefined(from._offset)) {
        to._offset = from._offset;
    }
    if (!isUndefined(from._pf)) {
        to._pf = getParsingFlags(from);
    }
    if (!isUndefined(from._locale)) {
        to._locale = from._locale;
    }

    if (momentProperties.length > 0) {
        for (i = 0; i < momentProperties.length; i++) {
            prop = momentProperties[i];
            val = from[prop];
            if (!isUndefined(val)) {
                to[prop] = val;
            }
        }
    }

    return to;
}

var updateInProgress = false;

// Moment prototype object
function Moment(config) {
    copyConfig(this, config);
    this._d = new Date(config._d != null ? config._d.getTime() : NaN);
    if (!this.isValid()) {
        this._d = new Date(NaN);
    }
    // Prevent infinite loop in case updateOffset creates new moment
    // objects.
    if (updateInProgress === false) {
        updateInProgress = true;
        hooks.updateOffset(this);
        updateInProgress = false;
    }
}

function isMoment (obj) {
    return obj instanceof Moment || (obj != null && obj._isAMomentObject != null);
}

function absFloor (number) {
    if (number < 0) {
        // -0 -> 0
        return Math.ceil(number) || 0;
    } else {
        return Math.floor(number);
    }
}

function toInt(argumentForCoercion) {
    var coercedNumber = +argumentForCoercion,
        value = 0;

    if (coercedNumber !== 0 && isFinite(coercedNumber)) {
        value = absFloor(coercedNumber);
    }

    return value;
}

// compare two arrays, return the number of differences
function compareArrays(array1, array2, dontConvert) {
    var len = Math.min(array1.length, array2.length),
        lengthDiff = Math.abs(array1.length - array2.length),
        diffs = 0,
        i;
    for (i = 0; i < len; i++) {
        if ((dontConvert && array1[i] !== array2[i]) ||
            (!dontConvert && toInt(array1[i]) !== toInt(array2[i]))) {
            diffs++;
        }
    }
    return diffs + lengthDiff;
}

function warn(msg) {
    if (hooks.suppressDeprecationWarnings === false &&
            (typeof console !==  'undefined') && console.warn) {
        console.warn('Deprecation warning: ' + msg);
    }
}

function deprecate(msg, fn) {
    var firstTime = true;

    return extend(function () {
        if (hooks.deprecationHandler != null) {
            hooks.deprecationHandler(null, msg);
        }
        if (firstTime) {
            var args = [];
            var arg;
            for (var i = 0; i < arguments.length; i++) {
                arg = '';
                if (typeof arguments[i] === 'object') {
                    arg += '\n[' + i + '] ';
                    for (var key in arguments[0]) {
                        arg += key + ': ' + arguments[0][key] + ', ';
                    }
                    arg = arg.slice(0, -2); // Remove trailing comma and space
                } else {
                    arg = arguments[i];
                }
                args.push(arg);
            }
            warn(msg + '\nArguments: ' + Array.prototype.slice.call(args).join('') + '\n' + (new Error()).stack);
            firstTime = false;
        }
        return fn.apply(this, arguments);
    }, fn);
}

var deprecations = {};

function deprecateSimple(name, msg) {
    if (hooks.deprecationHandler != null) {
        hooks.deprecationHandler(name, msg);
    }
    if (!deprecations[name]) {
        warn(msg);
        deprecations[name] = true;
    }
}

hooks.suppressDeprecationWarnings = false;
hooks.deprecationHandler = null;

function isFunction(input) {
    return input instanceof Function || Object.prototype.toString.call(input) === '[object Function]';
}

function set (config) {
    var prop, i;
    for (i in config) {
        prop = config[i];
        if (isFunction(prop)) {
            this[i] = prop;
        } else {
            this['_' + i] = prop;
        }
    }
    this._config = config;
    // Lenient ordinal parsing accepts just a number in addition to
    // number + (possibly) stuff coming from _dayOfMonthOrdinalParse.
    // TODO: Remove "ordinalParse" fallback in next major release.
    this._dayOfMonthOrdinalParseLenient = new RegExp(
        (this._dayOfMonthOrdinalParse.source || this._ordinalParse.source) +
            '|' + (/\d{1,2}/).source);
}

function mergeConfigs(parentConfig, childConfig) {
    var res = extend({}, parentConfig), prop;
    for (prop in childConfig) {
        if (hasOwnProp(childConfig, prop)) {
            if (isObject(parentConfig[prop]) && isObject(childConfig[prop])) {
                res[prop] = {};
                extend(res[prop], parentConfig[prop]);
                extend(res[prop], childConfig[prop]);
            } else if (childConfig[prop] != null) {
                res[prop] = childConfig[prop];
            } else {
                delete res[prop];
            }
        }
    }
    for (prop in parentConfig) {
        if (hasOwnProp(parentConfig, prop) &&
                !hasOwnProp(childConfig, prop) &&
                isObject(parentConfig[prop])) {
            // make sure changes to properties don't modify parent config
            res[prop] = extend({}, res[prop]);
        }
    }
    return res;
}

function Locale(config) {
    if (config != null) {
        this.set(config);
    }
}

var keys;

if (Object.keys) {
    keys = Object.keys;
} else {
    keys = function (obj) {
        var i, res = [];
        for (i in obj) {
            if (hasOwnProp(obj, i)) {
                res.push(i);
            }
        }
        return res;
    };
}

var defaultCalendar = {
    sameDay : '[Today at] LT',
    nextDay : '[Tomorrow at] LT',
    nextWeek : 'dddd [at] LT',
    lastDay : '[Yesterday at] LT',
    lastWeek : '[Last] dddd [at] LT',
    sameElse : 'L'
};

function calendar (key, mom, now) {
    var output = this._calendar[key] || this._calendar['sameElse'];
    return isFunction(output) ? output.call(mom, now) : output;
}

var defaultLongDateFormat = {
    LTS  : 'h:mm:ss A',
    LT   : 'h:mm A',
    L    : 'MM/DD/YYYY',
    LL   : 'MMMM D, YYYY',
    LLL  : 'MMMM D, YYYY h:mm A',
    LLLL : 'dddd, MMMM D, YYYY h:mm A'
};

function longDateFormat (key) {
    var format = this._longDateFormat[key],
        formatUpper = this._longDateFormat[key.toUpperCase()];

    if (format || !formatUpper) {
        return format;
    }

    this._longDateFormat[key] = formatUpper.replace(/MMMM|MM|DD|dddd/g, function (val) {
        return val.slice(1);
    });

    return this._longDateFormat[key];
}

var defaultInvalidDate = 'Invalid date';

function invalidDate () {
    return this._invalidDate;
}

var defaultOrdinal = '%d';
var defaultDayOfMonthOrdinalParse = /\d{1,2}/;

function ordinal (number) {
    return this._ordinal.replace('%d', number);
}

var defaultRelativeTime = {
    future : 'in %s',
    past   : '%s ago',
    s  : 'a few seconds',
    ss : '%d seconds',
    m  : 'a minute',
    mm : '%d minutes',
    h  : 'an hour',
    hh : '%d hours',
    d  : 'a day',
    dd : '%d days',
    M  : 'a month',
    MM : '%d months',
    y  : 'a year',
    yy : '%d years'
};

function relativeTime (number, withoutSuffix, string, isFuture) {
    var output = this._relativeTime[string];
    return (isFunction(output)) ?
        output(number, withoutSuffix, string, isFuture) :
        output.replace(/%d/i, number);
}

function pastFuture (diff, output) {
    var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
    return isFunction(format) ? format(output) : format.replace(/%s/i, output);
}

var aliases = {};

function addUnitAlias (unit, shorthand) {
    var lowerCase = unit.toLowerCase();
    aliases[lowerCase] = aliases[lowerCase + 's'] = aliases[shorthand] = unit;
}

function normalizeUnits(units) {
    return typeof units === 'string' ? aliases[units] || aliases[units.toLowerCase()] : undefined;
}

function normalizeObjectUnits(inputObject) {
    var normalizedInput = {},
        normalizedProp,
        prop;

    for (prop in inputObject) {
        if (hasOwnProp(inputObject, prop)) {
            normalizedProp = normalizeUnits(prop);
            if (normalizedProp) {
                normalizedInput[normalizedProp] = inputObject[prop];
            }
        }
    }

    return normalizedInput;
}

var priorities = {};

function addUnitPriority(unit, priority) {
    priorities[unit] = priority;
}

function getPrioritizedUnits(unitsObj) {
    var units = [];
    for (var u in unitsObj) {
        units.push({unit: u, priority: priorities[u]});
    }
    units.sort(function (a, b) {
        return a.priority - b.priority;
    });
    return units;
}

function zeroFill(number, targetLength, forceSign) {
    var absNumber = '' + Math.abs(number),
        zerosToFill = targetLength - absNumber.length,
        sign = number >= 0;
    return (sign ? (forceSign ? '+' : '') : '-') +
        Math.pow(10, Math.max(0, zerosToFill)).toString().substr(1) + absNumber;
}

var formattingTokens = /(\[[^\[]*\])|(\\)?([Hh]mm(ss)?|Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Qo?|YYYYYY|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|kk?|mm?|ss?|S{1,9}|x|X|zz?|ZZ?|.)/g;

var localFormattingTokens = /(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g;

var formatFunctions = {};

var formatTokenFunctions = {};

// token:    'M'
// padded:   ['MM', 2]
// ordinal:  'Mo'
// callback: function () { this.month() + 1 }
function addFormatToken (token, padded, ordinal, callback) {
    var func = callback;
    if (typeof callback === 'string') {
        func = function () {
            return this[callback]();
        };
    }
    if (token) {
        formatTokenFunctions[token] = func;
    }
    if (padded) {
        formatTokenFunctions[padded[0]] = function () {
            return zeroFill(func.apply(this, arguments), padded[1], padded[2]);
        };
    }
    if (ordinal) {
        formatTokenFunctions[ordinal] = function () {
            return this.localeData().ordinal(func.apply(this, arguments), token);
        };
    }
}

function removeFormattingTokens(input) {
    if (input.match(/\[[\s\S]/)) {
        return input.replace(/^\[|\]$/g, '');
    }
    return input.replace(/\\/g, '');
}

function makeFormatFunction(format) {
    var array = format.match(formattingTokens), i, length;

    for (i = 0, length = array.length; i < length; i++) {
        if (formatTokenFunctions[array[i]]) {
            array[i] = formatTokenFunctions[array[i]];
        } else {
            array[i] = removeFormattingTokens(array[i]);
        }
    }

    return function (mom) {
        var output = '', i;
        for (i = 0; i < length; i++) {
            output += isFunction(array[i]) ? array[i].call(mom, format) : array[i];
        }
        return output;
    };
}

// format date using native date object
function formatMoment(m, format) {
    if (!m.isValid()) {
        return m.localeData().invalidDate();
    }

    format = expandFormat(format, m.localeData());
    formatFunctions[format] = formatFunctions[format] || makeFormatFunction(format);

    return formatFunctions[format](m);
}

function expandFormat(format, locale) {
    var i = 5;

    function replaceLongDateFormatTokens(input) {
        return locale.longDateFormat(input) || input;
    }

    localFormattingTokens.lastIndex = 0;
    while (i >= 0 && localFormattingTokens.test(format)) {
        format = format.replace(localFormattingTokens, replaceLongDateFormatTokens);
        localFormattingTokens.lastIndex = 0;
        i -= 1;
    }

    return format;
}

var match1         = /\d/;            //       0 - 9
var match2         = /\d\d/;          //      00 - 99
var match3         = /\d{3}/;         //     000 - 999
var match4         = /\d{4}/;         //    0000 - 9999
var match6         = /[+-]?\d{6}/;    // -999999 - 999999
var match1to2      = /\d\d?/;         //       0 - 99
var match3to4      = /\d\d\d\d?/;     //     999 - 9999
var match5to6      = /\d\d\d\d\d\d?/; //   99999 - 999999
var match1to3      = /\d{1,3}/;       //       0 - 999
var match1to4      = /\d{1,4}/;       //       0 - 9999
var match1to6      = /[+-]?\d{1,6}/;  // -999999 - 999999

var matchUnsigned  = /\d+/;           //       0 - inf
var matchSigned    = /[+-]?\d+/;      //    -inf - inf

var matchOffset    = /Z|[+-]\d\d:?\d\d/gi; // +00:00 -00:00 +0000 -0000 or Z
var matchShortOffset = /Z|[+-]\d\d(?::?\d\d)?/gi; // +00 -00 +00:00 -00:00 +0000 -0000 or Z

var matchTimestamp = /[+-]?\d+(\.\d{1,3})?/; // 123456789 123456789.123

// any word (or two) characters or numbers including two/three word month in arabic.
// includes scottish gaelic two word and hyphenated months
var matchWord = /[0-9]{0,256}['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFF07\uFF10-\uFFEF]{1,256}|[\u0600-\u06FF\/]{1,256}(\s*?[\u0600-\u06FF]{1,256}){1,2}/i;

var regexes = {};

function addRegexToken (token, regex, strictRegex) {
    regexes[token] = isFunction(regex) ? regex : function (isStrict, localeData) {
        return (isStrict && strictRegex) ? strictRegex : regex;
    };
}

function getParseRegexForToken (token, config) {
    if (!hasOwnProp(regexes, token)) {
        return new RegExp(unescapeFormat(token));
    }

    return regexes[token](config._strict, config._locale);
}

// Code from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
function unescapeFormat(s) {
    return regexEscape(s.replace('\\', '').replace(/\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g, function (matched, p1, p2, p3, p4) {
        return p1 || p2 || p3 || p4;
    }));
}

function regexEscape(s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

var tokens = {};

function addParseToken (token, callback) {
    var i, func = callback;
    if (typeof token === 'string') {
        token = [token];
    }
    if (isNumber(callback)) {
        func = function (input, array) {
            array[callback] = toInt(input);
        };
    }
    for (i = 0; i < token.length; i++) {
        tokens[token[i]] = func;
    }
}

function addWeekParseToken (token, callback) {
    addParseToken(token, function (input, array, config, token) {
        config._w = config._w || {};
        callback(input, config._w, config, token);
    });
}

function addTimeToArrayFromToken(token, input, config) {
    if (input != null && hasOwnProp(tokens, token)) {
        tokens[token](input, config._a, config, token);
    }
}

var YEAR = 0;
var MONTH = 1;
var DATE = 2;
var HOUR = 3;
var MINUTE = 4;
var SECOND = 5;
var MILLISECOND = 6;
var WEEK = 7;
var WEEKDAY = 8;

// FORMATTING

addFormatToken('Y', 0, 0, function () {
    var y = this.year();
    return y <= 9999 ? '' + y : '+' + y;
});

addFormatToken(0, ['YY', 2], 0, function () {
    return this.year() % 100;
});

addFormatToken(0, ['YYYY',   4],       0, 'year');
addFormatToken(0, ['YYYYY',  5],       0, 'year');
addFormatToken(0, ['YYYYYY', 6, true], 0, 'year');

// ALIASES

addUnitAlias('year', 'y');

// PRIORITIES

addUnitPriority('year', 1);

// PARSING

addRegexToken('Y',      matchSigned);
addRegexToken('YY',     match1to2, match2);
addRegexToken('YYYY',   match1to4, match4);
addRegexToken('YYYYY',  match1to6, match6);
addRegexToken('YYYYYY', match1to6, match6);

addParseToken(['YYYYY', 'YYYYYY'], YEAR);
addParseToken('YYYY', function (input, array) {
    array[YEAR] = input.length === 2 ? hooks.parseTwoDigitYear(input) : toInt(input);
});
addParseToken('YY', function (input, array) {
    array[YEAR] = hooks.parseTwoDigitYear(input);
});
addParseToken('Y', function (input, array) {
    array[YEAR] = parseInt(input, 10);
});

// HELPERS

function daysInYear(year) {
    return isLeapYear(year) ? 366 : 365;
}

function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

// HOOKS

hooks.parseTwoDigitYear = function (input) {
    return toInt(input) + (toInt(input) > 68 ? 1900 : 2000);
};

// MOMENTS

var getSetYear = makeGetSet('FullYear', true);

function getIsLeapYear () {
    return isLeapYear(this.year());
}

function makeGetSet (unit, keepTime) {
    return function (value) {
        if (value != null) {
            set$1(this, unit, value);
            hooks.updateOffset(this, keepTime);
            return this;
        } else {
            return get(this, unit);
        }
    };
}

function get (mom, unit) {
    return mom.isValid() ?
        mom._d['get' + (mom._isUTC ? 'UTC' : '') + unit]() : NaN;
}

function set$1 (mom, unit, value) {
    if (mom.isValid() && !isNaN(value)) {
        if (unit === 'FullYear' && isLeapYear(mom.year()) && mom.month() === 1 && mom.date() === 29) {
            mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value, mom.month(), daysInMonth(value, mom.month()));
        }
        else {
            mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value);
        }
    }
}

// MOMENTS

function stringGet (units) {
    units = normalizeUnits(units);
    if (isFunction(this[units])) {
        return this[units]();
    }
    return this;
}


function stringSet (units, value) {
    if (typeof units === 'object') {
        units = normalizeObjectUnits(units);
        var prioritized = getPrioritizedUnits(units);
        for (var i = 0; i < prioritized.length; i++) {
            this[prioritized[i].unit](units[prioritized[i].unit]);
        }
    } else {
        units = normalizeUnits(units);
        if (isFunction(this[units])) {
            return this[units](value);
        }
    }
    return this;
}

function mod(n, x) {
    return ((n % x) + x) % x;
}

var indexOf;

if (Array.prototype.indexOf) {
    indexOf = Array.prototype.indexOf;
} else {
    indexOf = function (o) {
        // I know
        var i;
        for (i = 0; i < this.length; ++i) {
            if (this[i] === o) {
                return i;
            }
        }
        return -1;
    };
}

function daysInMonth(year, month) {
    if (isNaN(year) || isNaN(month)) {
        return NaN;
    }
    var modMonth = mod(month, 12);
    year += (month - modMonth) / 12;
    return modMonth === 1 ? (isLeapYear(year) ? 29 : 28) : (31 - modMonth % 7 % 2);
}

// FORMATTING

addFormatToken('M', ['MM', 2], 'Mo', function () {
    return this.month() + 1;
});

addFormatToken('MMM', 0, 0, function (format) {
    return this.localeData().monthsShort(this, format);
});

addFormatToken('MMMM', 0, 0, function (format) {
    return this.localeData().months(this, format);
});

// ALIASES

addUnitAlias('month', 'M');

// PRIORITY

addUnitPriority('month', 8);

// PARSING

addRegexToken('M',    match1to2);
addRegexToken('MM',   match1to2, match2);
addRegexToken('MMM',  function (isStrict, locale) {
    return locale.monthsShortRegex(isStrict);
});
addRegexToken('MMMM', function (isStrict, locale) {
    return locale.monthsRegex(isStrict);
});

addParseToken(['M', 'MM'], function (input, array) {
    array[MONTH] = toInt(input) - 1;
});

addParseToken(['MMM', 'MMMM'], function (input, array, config, token) {
    var month = config._locale.monthsParse(input, token, config._strict);
    // if we didn't find a month name, mark the date as invalid.
    if (month != null) {
        array[MONTH] = month;
    } else {
        getParsingFlags(config).invalidMonth = input;
    }
});

// LOCALES

var MONTHS_IN_FORMAT = /D[oD]?(\[[^\[\]]*\]|\s)+MMMM?/;
var defaultLocaleMonths = 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_');
function localeMonths (m, format) {
    if (!m) {
        return isArray(this._months) ? this._months :
            this._months['standalone'];
    }
    return isArray(this._months) ? this._months[m.month()] :
        this._months[(this._months.isFormat || MONTHS_IN_FORMAT).test(format) ? 'format' : 'standalone'][m.month()];
}

var defaultLocaleMonthsShort = 'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_');
function localeMonthsShort (m, format) {
    if (!m) {
        return isArray(this._monthsShort) ? this._monthsShort :
            this._monthsShort['standalone'];
    }
    return isArray(this._monthsShort) ? this._monthsShort[m.month()] :
        this._monthsShort[MONTHS_IN_FORMAT.test(format) ? 'format' : 'standalone'][m.month()];
}

function handleStrictParse(monthName, format, strict) {
    var i, ii, mom, llc = monthName.toLocaleLowerCase();
    if (!this._monthsParse) {
        // this is not used
        this._monthsParse = [];
        this._longMonthsParse = [];
        this._shortMonthsParse = [];
        for (i = 0; i < 12; ++i) {
            mom = createUTC([2000, i]);
            this._shortMonthsParse[i] = this.monthsShort(mom, '').toLocaleLowerCase();
            this._longMonthsParse[i] = this.months(mom, '').toLocaleLowerCase();
        }
    }

    if (strict) {
        if (format === 'MMM') {
            ii = indexOf.call(this._shortMonthsParse, llc);
            return ii !== -1 ? ii : null;
        } else {
            ii = indexOf.call(this._longMonthsParse, llc);
            return ii !== -1 ? ii : null;
        }
    } else {
        if (format === 'MMM') {
            ii = indexOf.call(this._shortMonthsParse, llc);
            if (ii !== -1) {
                return ii;
            }
            ii = indexOf.call(this._longMonthsParse, llc);
            return ii !== -1 ? ii : null;
        } else {
            ii = indexOf.call(this._longMonthsParse, llc);
            if (ii !== -1) {
                return ii;
            }
            ii = indexOf.call(this._shortMonthsParse, llc);
            return ii !== -1 ? ii : null;
        }
    }
}

function localeMonthsParse (monthName, format, strict) {
    var i, mom, regex;

    if (this._monthsParseExact) {
        return handleStrictParse.call(this, monthName, format, strict);
    }

    if (!this._monthsParse) {
        this._monthsParse = [];
        this._longMonthsParse = [];
        this._shortMonthsParse = [];
    }

    // TODO: add sorting
    // Sorting makes sure if one month (or abbr) is a prefix of another
    // see sorting in computeMonthsParse
    for (i = 0; i < 12; i++) {
        // make the regex if we don't have it already
        mom = createUTC([2000, i]);
        if (strict && !this._longMonthsParse[i]) {
            this._longMonthsParse[i] = new RegExp('^' + this.months(mom, '').replace('.', '') + '$', 'i');
            this._shortMonthsParse[i] = new RegExp('^' + this.monthsShort(mom, '').replace('.', '') + '$', 'i');
        }
        if (!strict && !this._monthsParse[i]) {
            regex = '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
            this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
        }
        // test the regex
        if (strict && format === 'MMMM' && this._longMonthsParse[i].test(monthName)) {
            return i;
        } else if (strict && format === 'MMM' && this._shortMonthsParse[i].test(monthName)) {
            return i;
        } else if (!strict && this._monthsParse[i].test(monthName)) {
            return i;
        }
    }
}

// MOMENTS

function setMonth (mom, value) {
    var dayOfMonth;

    if (!mom.isValid()) {
        // No op
        return mom;
    }

    if (typeof value === 'string') {
        if (/^\d+$/.test(value)) {
            value = toInt(value);
        } else {
            value = mom.localeData().monthsParse(value);
            // TODO: Another silent failure?
            if (!isNumber(value)) {
                return mom;
            }
        }
    }

    dayOfMonth = Math.min(mom.date(), daysInMonth(mom.year(), value));
    mom._d['set' + (mom._isUTC ? 'UTC' : '') + 'Month'](value, dayOfMonth);
    return mom;
}

function getSetMonth (value) {
    if (value != null) {
        setMonth(this, value);
        hooks.updateOffset(this, true);
        return this;
    } else {
        return get(this, 'Month');
    }
}

function getDaysInMonth () {
    return daysInMonth(this.year(), this.month());
}

var defaultMonthsShortRegex = matchWord;
function monthsShortRegex (isStrict) {
    if (this._monthsParseExact) {
        if (!hasOwnProp(this, '_monthsRegex')) {
            computeMonthsParse.call(this);
        }
        if (isStrict) {
            return this._monthsShortStrictRegex;
        } else {
            return this._monthsShortRegex;
        }
    } else {
        if (!hasOwnProp(this, '_monthsShortRegex')) {
            this._monthsShortRegex = defaultMonthsShortRegex;
        }
        return this._monthsShortStrictRegex && isStrict ?
            this._monthsShortStrictRegex : this._monthsShortRegex;
    }
}

var defaultMonthsRegex = matchWord;
function monthsRegex (isStrict) {
    if (this._monthsParseExact) {
        if (!hasOwnProp(this, '_monthsRegex')) {
            computeMonthsParse.call(this);
        }
        if (isStrict) {
            return this._monthsStrictRegex;
        } else {
            return this._monthsRegex;
        }
    } else {
        if (!hasOwnProp(this, '_monthsRegex')) {
            this._monthsRegex = defaultMonthsRegex;
        }
        return this._monthsStrictRegex && isStrict ?
            this._monthsStrictRegex : this._monthsRegex;
    }
}

function computeMonthsParse () {
    function cmpLenRev(a, b) {
        return b.length - a.length;
    }

    var shortPieces = [], longPieces = [], mixedPieces = [],
        i, mom;
    for (i = 0; i < 12; i++) {
        // make the regex if we don't have it already
        mom = createUTC([2000, i]);
        shortPieces.push(this.monthsShort(mom, ''));
        longPieces.push(this.months(mom, ''));
        mixedPieces.push(this.months(mom, ''));
        mixedPieces.push(this.monthsShort(mom, ''));
    }
    // Sorting makes sure if one month (or abbr) is a prefix of another it
    // will match the longer piece.
    shortPieces.sort(cmpLenRev);
    longPieces.sort(cmpLenRev);
    mixedPieces.sort(cmpLenRev);
    for (i = 0; i < 12; i++) {
        shortPieces[i] = regexEscape(shortPieces[i]);
        longPieces[i] = regexEscape(longPieces[i]);
    }
    for (i = 0; i < 24; i++) {
        mixedPieces[i] = regexEscape(mixedPieces[i]);
    }

    this._monthsRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
    this._monthsShortRegex = this._monthsRegex;
    this._monthsStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
    this._monthsShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
}

function createDate (y, m, d, h, M, s, ms) {
    // can't just apply() to create a date:
    // https://stackoverflow.com/q/181348
    var date = new Date(y, m, d, h, M, s, ms);

    // the date constructor remaps years 0-99 to 1900-1999
    if (y < 100 && y >= 0 && isFinite(date.getFullYear())) {
        date.setFullYear(y);
    }
    return date;
}

function createUTCDate (y) {
    var date = new Date(Date.UTC.apply(null, arguments));

    // the Date.UTC function remaps years 0-99 to 1900-1999
    if (y < 100 && y >= 0 && isFinite(date.getUTCFullYear())) {
        date.setUTCFullYear(y);
    }
    return date;
}

// start-of-first-week - start-of-year
function firstWeekOffset(year, dow, doy) {
    var // first-week day -- which january is always in the first week (4 for iso, 1 for other)
        fwd = 7 + dow - doy,
        // first-week day local weekday -- which local weekday is fwd
        fwdlw = (7 + createUTCDate(year, 0, fwd).getUTCDay() - dow) % 7;

    return -fwdlw + fwd - 1;
}

// https://en.wikipedia.org/wiki/ISO_week_date#Calculating_a_date_given_the_year.2C_week_number_and_weekday
function dayOfYearFromWeeks(year, week, weekday, dow, doy) {
    var localWeekday = (7 + weekday - dow) % 7,
        weekOffset = firstWeekOffset(year, dow, doy),
        dayOfYear = 1 + 7 * (week - 1) + localWeekday + weekOffset,
        resYear, resDayOfYear;

    if (dayOfYear <= 0) {
        resYear = year - 1;
        resDayOfYear = daysInYear(resYear) + dayOfYear;
    } else if (dayOfYear > daysInYear(year)) {
        resYear = year + 1;
        resDayOfYear = dayOfYear - daysInYear(year);
    } else {
        resYear = year;
        resDayOfYear = dayOfYear;
    }

    return {
        year: resYear,
        dayOfYear: resDayOfYear
    };
}

function weekOfYear(mom, dow, doy) {
    var weekOffset = firstWeekOffset(mom.year(), dow, doy),
        week = Math.floor((mom.dayOfYear() - weekOffset - 1) / 7) + 1,
        resWeek, resYear;

    if (week < 1) {
        resYear = mom.year() - 1;
        resWeek = week + weeksInYear(resYear, dow, doy);
    } else if (week > weeksInYear(mom.year(), dow, doy)) {
        resWeek = week - weeksInYear(mom.year(), dow, doy);
        resYear = mom.year() + 1;
    } else {
        resYear = mom.year();
        resWeek = week;
    }

    return {
        week: resWeek,
        year: resYear
    };
}

function weeksInYear(year, dow, doy) {
    var weekOffset = firstWeekOffset(year, dow, doy),
        weekOffsetNext = firstWeekOffset(year + 1, dow, doy);
    return (daysInYear(year) - weekOffset + weekOffsetNext) / 7;
}

// FORMATTING

addFormatToken('w', ['ww', 2], 'wo', 'week');
addFormatToken('W', ['WW', 2], 'Wo', 'isoWeek');

// ALIASES

addUnitAlias('week', 'w');
addUnitAlias('isoWeek', 'W');

// PRIORITIES

addUnitPriority('week', 5);
addUnitPriority('isoWeek', 5);

// PARSING

addRegexToken('w',  match1to2);
addRegexToken('ww', match1to2, match2);
addRegexToken('W',  match1to2);
addRegexToken('WW', match1to2, match2);

addWeekParseToken(['w', 'ww', 'W', 'WW'], function (input, week, config, token) {
    week[token.substr(0, 1)] = toInt(input);
});

// HELPERS

// LOCALES

function localeWeek (mom) {
    return weekOfYear(mom, this._week.dow, this._week.doy).week;
}

var defaultLocaleWeek = {
    dow : 0, // Sunday is the first day of the week.
    doy : 6  // The week that contains Jan 1st is the first week of the year.
};

function localeFirstDayOfWeek () {
    return this._week.dow;
}

function localeFirstDayOfYear () {
    return this._week.doy;
}

// MOMENTS

function getSetWeek (input) {
    var week = this.localeData().week(this);
    return input == null ? week : this.add((input - week) * 7, 'd');
}

function getSetISOWeek (input) {
    var week = weekOfYear(this, 1, 4).week;
    return input == null ? week : this.add((input - week) * 7, 'd');
}

// FORMATTING

addFormatToken('d', 0, 'do', 'day');

addFormatToken('dd', 0, 0, function (format) {
    return this.localeData().weekdaysMin(this, format);
});

addFormatToken('ddd', 0, 0, function (format) {
    return this.localeData().weekdaysShort(this, format);
});

addFormatToken('dddd', 0, 0, function (format) {
    return this.localeData().weekdays(this, format);
});

addFormatToken('e', 0, 0, 'weekday');
addFormatToken('E', 0, 0, 'isoWeekday');

// ALIASES

addUnitAlias('day', 'd');
addUnitAlias('weekday', 'e');
addUnitAlias('isoWeekday', 'E');

// PRIORITY
addUnitPriority('day', 11);
addUnitPriority('weekday', 11);
addUnitPriority('isoWeekday', 11);

// PARSING

addRegexToken('d',    match1to2);
addRegexToken('e',    match1to2);
addRegexToken('E',    match1to2);
addRegexToken('dd',   function (isStrict, locale) {
    return locale.weekdaysMinRegex(isStrict);
});
addRegexToken('ddd',   function (isStrict, locale) {
    return locale.weekdaysShortRegex(isStrict);
});
addRegexToken('dddd',   function (isStrict, locale) {
    return locale.weekdaysRegex(isStrict);
});

addWeekParseToken(['dd', 'ddd', 'dddd'], function (input, week, config, token) {
    var weekday = config._locale.weekdaysParse(input, token, config._strict);
    // if we didn't get a weekday name, mark the date as invalid
    if (weekday != null) {
        week.d = weekday;
    } else {
        getParsingFlags(config).invalidWeekday = input;
    }
});

addWeekParseToken(['d', 'e', 'E'], function (input, week, config, token) {
    week[token] = toInt(input);
});

// HELPERS

function parseWeekday(input, locale) {
    if (typeof input !== 'string') {
        return input;
    }

    if (!isNaN(input)) {
        return parseInt(input, 10);
    }

    input = locale.weekdaysParse(input);
    if (typeof input === 'number') {
        return input;
    }

    return null;
}

function parseIsoWeekday(input, locale) {
    if (typeof input === 'string') {
        return locale.weekdaysParse(input) % 7 || 7;
    }
    return isNaN(input) ? null : input;
}

// LOCALES

var defaultLocaleWeekdays = 'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_');
function localeWeekdays (m, format) {
    if (!m) {
        return isArray(this._weekdays) ? this._weekdays :
            this._weekdays['standalone'];
    }
    return isArray(this._weekdays) ? this._weekdays[m.day()] :
        this._weekdays[this._weekdays.isFormat.test(format) ? 'format' : 'standalone'][m.day()];
}

var defaultLocaleWeekdaysShort = 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_');
function localeWeekdaysShort (m) {
    return (m) ? this._weekdaysShort[m.day()] : this._weekdaysShort;
}

var defaultLocaleWeekdaysMin = 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_');
function localeWeekdaysMin (m) {
    return (m) ? this._weekdaysMin[m.day()] : this._weekdaysMin;
}

function handleStrictParse$1(weekdayName, format, strict) {
    var i, ii, mom, llc = weekdayName.toLocaleLowerCase();
    if (!this._weekdaysParse) {
        this._weekdaysParse = [];
        this._shortWeekdaysParse = [];
        this._minWeekdaysParse = [];

        for (i = 0; i < 7; ++i) {
            mom = createUTC([2000, 1]).day(i);
            this._minWeekdaysParse[i] = this.weekdaysMin(mom, '').toLocaleLowerCase();
            this._shortWeekdaysParse[i] = this.weekdaysShort(mom, '').toLocaleLowerCase();
            this._weekdaysParse[i] = this.weekdays(mom, '').toLocaleLowerCase();
        }
    }

    if (strict) {
        if (format === 'dddd') {
            ii = indexOf.call(this._weekdaysParse, llc);
            return ii !== -1 ? ii : null;
        } else if (format === 'ddd') {
            ii = indexOf.call(this._shortWeekdaysParse, llc);
            return ii !== -1 ? ii : null;
        } else {
            ii = indexOf.call(this._minWeekdaysParse, llc);
            return ii !== -1 ? ii : null;
        }
    } else {
        if (format === 'dddd') {
            ii = indexOf.call(this._weekdaysParse, llc);
            if (ii !== -1) {
                return ii;
            }
            ii = indexOf.call(this._shortWeekdaysParse, llc);
            if (ii !== -1) {
                return ii;
            }
            ii = indexOf.call(this._minWeekdaysParse, llc);
            return ii !== -1 ? ii : null;
        } else if (format === 'ddd') {
            ii = indexOf.call(this._shortWeekdaysParse, llc);
            if (ii !== -1) {
                return ii;
            }
            ii = indexOf.call(this._weekdaysParse, llc);
            if (ii !== -1) {
                return ii;
            }
            ii = indexOf.call(this._minWeekdaysParse, llc);
            return ii !== -1 ? ii : null;
        } else {
            ii = indexOf.call(this._minWeekdaysParse, llc);
            if (ii !== -1) {
                return ii;
            }
            ii = indexOf.call(this._weekdaysParse, llc);
            if (ii !== -1) {
                return ii;
            }
            ii = indexOf.call(this._shortWeekdaysParse, llc);
            return ii !== -1 ? ii : null;
        }
    }
}

function localeWeekdaysParse (weekdayName, format, strict) {
    var i, mom, regex;

    if (this._weekdaysParseExact) {
        return handleStrictParse$1.call(this, weekdayName, format, strict);
    }

    if (!this._weekdaysParse) {
        this._weekdaysParse = [];
        this._minWeekdaysParse = [];
        this._shortWeekdaysParse = [];
        this._fullWeekdaysParse = [];
    }

    for (i = 0; i < 7; i++) {
        // make the regex if we don't have it already

        mom = createUTC([2000, 1]).day(i);
        if (strict && !this._fullWeekdaysParse[i]) {
            this._fullWeekdaysParse[i] = new RegExp('^' + this.weekdays(mom, '').replace('.', '\.?') + '$', 'i');
            this._shortWeekdaysParse[i] = new RegExp('^' + this.weekdaysShort(mom, '').replace('.', '\.?') + '$', 'i');
            this._minWeekdaysParse[i] = new RegExp('^' + this.weekdaysMin(mom, '').replace('.', '\.?') + '$', 'i');
        }
        if (!this._weekdaysParse[i]) {
            regex = '^' + this.weekdays(mom, '') + '|^' + this.weekdaysShort(mom, '') + '|^' + this.weekdaysMin(mom, '');
            this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
        }
        // test the regex
        if (strict && format === 'dddd' && this._fullWeekdaysParse[i].test(weekdayName)) {
            return i;
        } else if (strict && format === 'ddd' && this._shortWeekdaysParse[i].test(weekdayName)) {
            return i;
        } else if (strict && format === 'dd' && this._minWeekdaysParse[i].test(weekdayName)) {
            return i;
        } else if (!strict && this._weekdaysParse[i].test(weekdayName)) {
            return i;
        }
    }
}

// MOMENTS

function getSetDayOfWeek (input) {
    if (!this.isValid()) {
        return input != null ? this : NaN;
    }
    var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
    if (input != null) {
        input = parseWeekday(input, this.localeData());
        return this.add(input - day, 'd');
    } else {
        return day;
    }
}

function getSetLocaleDayOfWeek (input) {
    if (!this.isValid()) {
        return input != null ? this : NaN;
    }
    var weekday = (this.day() + 7 - this.localeData()._week.dow) % 7;
    return input == null ? weekday : this.add(input - weekday, 'd');
}

function getSetISODayOfWeek (input) {
    if (!this.isValid()) {
        return input != null ? this : NaN;
    }

    // behaves the same as moment#day except
    // as a getter, returns 7 instead of 0 (1-7 range instead of 0-6)
    // as a setter, sunday should belong to the previous week.

    if (input != null) {
        var weekday = parseIsoWeekday(input, this.localeData());
        return this.day(this.day() % 7 ? weekday : weekday - 7);
    } else {
        return this.day() || 7;
    }
}

var defaultWeekdaysRegex = matchWord;
function weekdaysRegex (isStrict) {
    if (this._weekdaysParseExact) {
        if (!hasOwnProp(this, '_weekdaysRegex')) {
            computeWeekdaysParse.call(this);
        }
        if (isStrict) {
            return this._weekdaysStrictRegex;
        } else {
            return this._weekdaysRegex;
        }
    } else {
        if (!hasOwnProp(this, '_weekdaysRegex')) {
            this._weekdaysRegex = defaultWeekdaysRegex;
        }
        return this._weekdaysStrictRegex && isStrict ?
            this._weekdaysStrictRegex : this._weekdaysRegex;
    }
}

var defaultWeekdaysShortRegex = matchWord;
function weekdaysShortRegex (isStrict) {
    if (this._weekdaysParseExact) {
        if (!hasOwnProp(this, '_weekdaysRegex')) {
            computeWeekdaysParse.call(this);
        }
        if (isStrict) {
            return this._weekdaysShortStrictRegex;
        } else {
            return this._weekdaysShortRegex;
        }
    } else {
        if (!hasOwnProp(this, '_weekdaysShortRegex')) {
            this._weekdaysShortRegex = defaultWeekdaysShortRegex;
        }
        return this._weekdaysShortStrictRegex && isStrict ?
            this._weekdaysShortStrictRegex : this._weekdaysShortRegex;
    }
}

var defaultWeekdaysMinRegex = matchWord;
function weekdaysMinRegex (isStrict) {
    if (this._weekdaysParseExact) {
        if (!hasOwnProp(this, '_weekdaysRegex')) {
            computeWeekdaysParse.call(this);
        }
        if (isStrict) {
            return this._weekdaysMinStrictRegex;
        } else {
            return this._weekdaysMinRegex;
        }
    } else {
        if (!hasOwnProp(this, '_weekdaysMinRegex')) {
            this._weekdaysMinRegex = defaultWeekdaysMinRegex;
        }
        return this._weekdaysMinStrictRegex && isStrict ?
            this._weekdaysMinStrictRegex : this._weekdaysMinRegex;
    }
}


function computeWeekdaysParse () {
    function cmpLenRev(a, b) {
        return b.length - a.length;
    }

    var minPieces = [], shortPieces = [], longPieces = [], mixedPieces = [],
        i, mom, minp, shortp, longp;
    for (i = 0; i < 7; i++) {
        // make the regex if we don't have it already
        mom = createUTC([2000, 1]).day(i);
        minp = this.weekdaysMin(mom, '');
        shortp = this.weekdaysShort(mom, '');
        longp = this.weekdays(mom, '');
        minPieces.push(minp);
        shortPieces.push(shortp);
        longPieces.push(longp);
        mixedPieces.push(minp);
        mixedPieces.push(shortp);
        mixedPieces.push(longp);
    }
    // Sorting makes sure if one weekday (or abbr) is a prefix of another it
    // will match the longer piece.
    minPieces.sort(cmpLenRev);
    shortPieces.sort(cmpLenRev);
    longPieces.sort(cmpLenRev);
    mixedPieces.sort(cmpLenRev);
    for (i = 0; i < 7; i++) {
        shortPieces[i] = regexEscape(shortPieces[i]);
        longPieces[i] = regexEscape(longPieces[i]);
        mixedPieces[i] = regexEscape(mixedPieces[i]);
    }

    this._weekdaysRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
    this._weekdaysShortRegex = this._weekdaysRegex;
    this._weekdaysMinRegex = this._weekdaysRegex;

    this._weekdaysStrictRegex = new RegExp('^(' + longPieces.join('|') + ')', 'i');
    this._weekdaysShortStrictRegex = new RegExp('^(' + shortPieces.join('|') + ')', 'i');
    this._weekdaysMinStrictRegex = new RegExp('^(' + minPieces.join('|') + ')', 'i');
}

// FORMATTING

function hFormat() {
    return this.hours() % 12 || 12;
}

function kFormat() {
    return this.hours() || 24;
}

addFormatToken('H', ['HH', 2], 0, 'hour');
addFormatToken('h', ['hh', 2], 0, hFormat);
addFormatToken('k', ['kk', 2], 0, kFormat);

addFormatToken('hmm', 0, 0, function () {
    return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2);
});

addFormatToken('hmmss', 0, 0, function () {
    return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2) +
        zeroFill(this.seconds(), 2);
});

addFormatToken('Hmm', 0, 0, function () {
    return '' + this.hours() + zeroFill(this.minutes(), 2);
});

addFormatToken('Hmmss', 0, 0, function () {
    return '' + this.hours() + zeroFill(this.minutes(), 2) +
        zeroFill(this.seconds(), 2);
});

function meridiem (token, lowercase) {
    addFormatToken(token, 0, 0, function () {
        return this.localeData().meridiem(this.hours(), this.minutes(), lowercase);
    });
}

meridiem('a', true);
meridiem('A', false);

// ALIASES

addUnitAlias('hour', 'h');

// PRIORITY
addUnitPriority('hour', 13);

// PARSING

function matchMeridiem (isStrict, locale) {
    return locale._meridiemParse;
}

addRegexToken('a',  matchMeridiem);
addRegexToken('A',  matchMeridiem);
addRegexToken('H',  match1to2);
addRegexToken('h',  match1to2);
addRegexToken('k',  match1to2);
addRegexToken('HH', match1to2, match2);
addRegexToken('hh', match1to2, match2);
addRegexToken('kk', match1to2, match2);

addRegexToken('hmm', match3to4);
addRegexToken('hmmss', match5to6);
addRegexToken('Hmm', match3to4);
addRegexToken('Hmmss', match5to6);

addParseToken(['H', 'HH'], HOUR);
addParseToken(['k', 'kk'], function (input, array, config) {
    var kInput = toInt(input);
    array[HOUR] = kInput === 24 ? 0 : kInput;
});
addParseToken(['a', 'A'], function (input, array, config) {
    config._isPm = config._locale.isPM(input);
    config._meridiem = input;
});
addParseToken(['h', 'hh'], function (input, array, config) {
    array[HOUR] = toInt(input);
    getParsingFlags(config).bigHour = true;
});
addParseToken('hmm', function (input, array, config) {
    var pos = input.length - 2;
    array[HOUR] = toInt(input.substr(0, pos));
    array[MINUTE] = toInt(input.substr(pos));
    getParsingFlags(config).bigHour = true;
});
addParseToken('hmmss', function (input, array, config) {
    var pos1 = input.length - 4;
    var pos2 = input.length - 2;
    array[HOUR] = toInt(input.substr(0, pos1));
    array[MINUTE] = toInt(input.substr(pos1, 2));
    array[SECOND] = toInt(input.substr(pos2));
    getParsingFlags(config).bigHour = true;
});
addParseToken('Hmm', function (input, array, config) {
    var pos = input.length - 2;
    array[HOUR] = toInt(input.substr(0, pos));
    array[MINUTE] = toInt(input.substr(pos));
});
addParseToken('Hmmss', function (input, array, config) {
    var pos1 = input.length - 4;
    var pos2 = input.length - 2;
    array[HOUR] = toInt(input.substr(0, pos1));
    array[MINUTE] = toInt(input.substr(pos1, 2));
    array[SECOND] = toInt(input.substr(pos2));
});

// LOCALES

function localeIsPM (input) {
    // IE8 Quirks Mode & IE7 Standards Mode do not allow accessing strings like arrays
    // Using charAt should be more compatible.
    return ((input + '').toLowerCase().charAt(0) === 'p');
}

var defaultLocaleMeridiemParse = /[ap]\.?m?\.?/i;
function localeMeridiem (hours, minutes, isLower) {
    if (hours > 11) {
        return isLower ? 'pm' : 'PM';
    } else {
        return isLower ? 'am' : 'AM';
    }
}


// MOMENTS

// Setting the hour should keep the time, because the user explicitly
// specified which hour he wants. So trying to maintain the same hour (in
// a new timezone) makes sense. Adding/subtracting hours does not follow
// this rule.
var getSetHour = makeGetSet('Hours', true);

var baseConfig = {
    calendar: defaultCalendar,
    longDateFormat: defaultLongDateFormat,
    invalidDate: defaultInvalidDate,
    ordinal: defaultOrdinal,
    dayOfMonthOrdinalParse: defaultDayOfMonthOrdinalParse,
    relativeTime: defaultRelativeTime,

    months: defaultLocaleMonths,
    monthsShort: defaultLocaleMonthsShort,

    week: defaultLocaleWeek,

    weekdays: defaultLocaleWeekdays,
    weekdaysMin: defaultLocaleWeekdaysMin,
    weekdaysShort: defaultLocaleWeekdaysShort,

    meridiemParse: defaultLocaleMeridiemParse
};

// internal storage for locale config files
var locales = {};
var localeFamilies = {};
var globalLocale;

function normalizeLocale(key) {
    return key ? key.toLowerCase().replace('_', '-') : key;
}

// pick the locale from the array
// try ['en-au', 'en-gb'] as 'en-au', 'en-gb', 'en', as in move through the list trying each
// substring from most specific to least, but move to the next array item if it's a more specific variant than the current root
function chooseLocale(names) {
    var i = 0, j, next, locale, split;

    while (i < names.length) {
        split = normalizeLocale(names[i]).split('-');
        j = split.length;
        next = normalizeLocale(names[i + 1]);
        next = next ? next.split('-') : null;
        while (j > 0) {
            locale = loadLocale(split.slice(0, j).join('-'));
            if (locale) {
                return locale;
            }
            if (next && next.length >= j && compareArrays(split, next, true) >= j - 1) {
                //the next array item is better than a shallower substring of this one
                break;
            }
            j--;
        }
        i++;
    }
    return globalLocale;
}

function loadLocale(name) {
    var oldLocale = null;
    // TODO: Find a better way to register and load all the locales in Node
    if (!locales[name] && (typeof module !== 'undefined') &&
            module && module.exports) {
        try {
            oldLocale = globalLocale._abbr;
            var aliasedRequire = require;
            aliasedRequire('./locale/' + name);
            getSetGlobalLocale(oldLocale);
        } catch (e) {}
    }
    return locales[name];
}

// This function will load locale and then set the global locale.  If
// no arguments are passed in, it will simply return the current global
// locale key.
function getSetGlobalLocale (key, values) {
    var data;
    if (key) {
        if (isUndefined(values)) {
            data = getLocale(key);
        }
        else {
            data = defineLocale(key, values);
        }

        if (data) {
            // moment.duration._locale = moment._locale = data;
            globalLocale = data;
        }
        else {
            if ((typeof console !==  'undefined') && console.warn) {
                //warn user if arguments are passed but the locale could not be set
                console.warn('Locale ' + key +  ' not found. Did you forget to load it?');
            }
        }
    }

    return globalLocale._abbr;
}

function defineLocale (name, config) {
    if (config !== null) {
        var locale, parentConfig = baseConfig;
        config.abbr = name;
        if (locales[name] != null) {
            deprecateSimple('defineLocaleOverride',
                    'use moment.updateLocale(localeName, config) to change ' +
                    'an existing locale. moment.defineLocale(localeName, ' +
                    'config) should only be used for creating a new locale ' +
                    'See http://momentjs.com/guides/#/warnings/define-locale/ for more info.');
            parentConfig = locales[name]._config;
        } else if (config.parentLocale != null) {
            if (locales[config.parentLocale] != null) {
                parentConfig = locales[config.parentLocale]._config;
            } else {
                locale = loadLocale(config.parentLocale);
                if (locale != null) {
                    parentConfig = locale._config;
                } else {
                    if (!localeFamilies[config.parentLocale]) {
                        localeFamilies[config.parentLocale] = [];
                    }
                    localeFamilies[config.parentLocale].push({
                        name: name,
                        config: config
                    });
                    return null;
                }
            }
        }
        locales[name] = new Locale(mergeConfigs(parentConfig, config));

        if (localeFamilies[name]) {
            localeFamilies[name].forEach(function (x) {
                defineLocale(x.name, x.config);
            });
        }

        // backwards compat for now: also set the locale
        // make sure we set the locale AFTER all child locales have been
        // created, so we won't end up with the child locale set.
        getSetGlobalLocale(name);


        return locales[name];
    } else {
        // useful for testing
        delete locales[name];
        return null;
    }
}

function updateLocale(name, config) {
    if (config != null) {
        var locale, tmpLocale, parentConfig = baseConfig;
        // MERGE
        tmpLocale = loadLocale(name);
        if (tmpLocale != null) {
            parentConfig = tmpLocale._config;
        }
        config = mergeConfigs(parentConfig, config);
        locale = new Locale(config);
        locale.parentLocale = locales[name];
        locales[name] = locale;

        // backwards compat for now: also set the locale
        getSetGlobalLocale(name);
    } else {
        // pass null for config to unupdate, useful for tests
        if (locales[name] != null) {
            if (locales[name].parentLocale != null) {
                locales[name] = locales[name].parentLocale;
            } else if (locales[name] != null) {
                delete locales[name];
            }
        }
    }
    return locales[name];
}

// returns locale data
function getLocale (key) {
    var locale;

    if (key && key._locale && key._locale._abbr) {
        key = key._locale._abbr;
    }

    if (!key) {
        return globalLocale;
    }

    if (!isArray(key)) {
        //short-circuit everything else
        locale = loadLocale(key);
        if (locale) {
            return locale;
        }
        key = [key];
    }

    return chooseLocale(key);
}

function listLocales() {
    return keys(locales);
}

function checkOverflow (m) {
    var overflow;
    var a = m._a;

    if (a && getParsingFlags(m).overflow === -2) {
        overflow =
            a[MONTH]       < 0 || a[MONTH]       > 11  ? MONTH :
            a[DATE]        < 1 || a[DATE]        > daysInMonth(a[YEAR], a[MONTH]) ? DATE :
            a[HOUR]        < 0 || a[HOUR]        > 24 || (a[HOUR] === 24 && (a[MINUTE] !== 0 || a[SECOND] !== 0 || a[MILLISECOND] !== 0)) ? HOUR :
            a[MINUTE]      < 0 || a[MINUTE]      > 59  ? MINUTE :
            a[SECOND]      < 0 || a[SECOND]      > 59  ? SECOND :
            a[MILLISECOND] < 0 || a[MILLISECOND] > 999 ? MILLISECOND :
            -1;

        if (getParsingFlags(m)._overflowDayOfYear && (overflow < YEAR || overflow > DATE)) {
            overflow = DATE;
        }
        if (getParsingFlags(m)._overflowWeeks && overflow === -1) {
            overflow = WEEK;
        }
        if (getParsingFlags(m)._overflowWeekday && overflow === -1) {
            overflow = WEEKDAY;
        }

        getParsingFlags(m).overflow = overflow;
    }

    return m;
}

// Pick the first defined of two or three arguments.
function defaults(a, b, c) {
    if (a != null) {
        return a;
    }
    if (b != null) {
        return b;
    }
    return c;
}

function currentDateArray(config) {
    // hooks is actually the exported moment object
    var nowValue = new Date(hooks.now());
    if (config._useUTC) {
        return [nowValue.getUTCFullYear(), nowValue.getUTCMonth(), nowValue.getUTCDate()];
    }
    return [nowValue.getFullYear(), nowValue.getMonth(), nowValue.getDate()];
}

// convert an array to a date.
// the array should mirror the parameters below
// note: all values past the year are optional and will default to the lowest possible value.
// [year, month, day , hour, minute, second, millisecond]
function configFromArray (config) {
    var i, date, input = [], currentDate, expectedWeekday, yearToUse;

    if (config._d) {
        return;
    }

    currentDate = currentDateArray(config);

    //compute day of the year from weeks and weekdays
    if (config._w && config._a[DATE] == null && config._a[MONTH] == null) {
        dayOfYearFromWeekInfo(config);
    }

    //if the day of the year is set, figure out what it is
    if (config._dayOfYear != null) {
        yearToUse = defaults(config._a[YEAR], currentDate[YEAR]);

        if (config._dayOfYear > daysInYear(yearToUse) || config._dayOfYear === 0) {
            getParsingFlags(config)._overflowDayOfYear = true;
        }

        date = createUTCDate(yearToUse, 0, config._dayOfYear);
        config._a[MONTH] = date.getUTCMonth();
        config._a[DATE] = date.getUTCDate();
    }

    // Default to current date.
    // * if no year, month, day of month are given, default to today
    // * if day of month is given, default month and year
    // * if month is given, default only year
    // * if year is given, don't default anything
    for (i = 0; i < 3 && config._a[i] == null; ++i) {
        config._a[i] = input[i] = currentDate[i];
    }

    // Zero out whatever was not defaulted, including time
    for (; i < 7; i++) {
        config._a[i] = input[i] = (config._a[i] == null) ? (i === 2 ? 1 : 0) : config._a[i];
    }

    // Check for 24:00:00.000
    if (config._a[HOUR] === 24 &&
            config._a[MINUTE] === 0 &&
            config._a[SECOND] === 0 &&
            config._a[MILLISECOND] === 0) {
        config._nextDay = true;
        config._a[HOUR] = 0;
    }

    config._d = (config._useUTC ? createUTCDate : createDate).apply(null, input);
    expectedWeekday = config._useUTC ? config._d.getUTCDay() : config._d.getDay();

    // Apply timezone offset from input. The actual utcOffset can be changed
    // with parseZone.
    if (config._tzm != null) {
        config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);
    }

    if (config._nextDay) {
        config._a[HOUR] = 24;
    }

    // check for mismatching day of week
    if (config._w && typeof config._w.d !== 'undefined' && config._w.d !== expectedWeekday) {
        getParsingFlags(config).weekdayMismatch = true;
    }
}

function dayOfYearFromWeekInfo(config) {
    var w, weekYear, week, weekday, dow, doy, temp, weekdayOverflow;

    w = config._w;
    if (w.GG != null || w.W != null || w.E != null) {
        dow = 1;
        doy = 4;

        // TODO: We need to take the current isoWeekYear, but that depends on
        // how we interpret now (local, utc, fixed offset). So create
        // a now version of current config (take local/utc/offset flags, and
        // create now).
        weekYear = defaults(w.GG, config._a[YEAR], weekOfYear(createLocal(), 1, 4).year);
        week = defaults(w.W, 1);
        weekday = defaults(w.E, 1);
        if (weekday < 1 || weekday > 7) {
            weekdayOverflow = true;
        }
    } else {
        dow = config._locale._week.dow;
        doy = config._locale._week.doy;

        var curWeek = weekOfYear(createLocal(), dow, doy);

        weekYear = defaults(w.gg, config._a[YEAR], curWeek.year);

        // Default to current week.
        week = defaults(w.w, curWeek.week);

        if (w.d != null) {
            // weekday -- low day numbers are considered next week
            weekday = w.d;
            if (weekday < 0 || weekday > 6) {
                weekdayOverflow = true;
            }
        } else if (w.e != null) {
            // local weekday -- counting starts from begining of week
            weekday = w.e + dow;
            if (w.e < 0 || w.e > 6) {
                weekdayOverflow = true;
            }
        } else {
            // default to begining of week
            weekday = dow;
        }
    }
    if (week < 1 || week > weeksInYear(weekYear, dow, doy)) {
        getParsingFlags(config)._overflowWeeks = true;
    } else if (weekdayOverflow != null) {
        getParsingFlags(config)._overflowWeekday = true;
    } else {
        temp = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy);
        config._a[YEAR] = temp.year;
        config._dayOfYear = temp.dayOfYear;
    }
}

// iso 8601 regex
// 0000-00-00 0000-W00 or 0000-W00-0 + T + 00 or 00:00 or 00:00:00 or 00:00:00.000 + +00:00 or +0000 or +00)
var extendedIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})-(?:\d\d-\d\d|W\d\d-\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?::\d\d(?::\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;
var basicIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})(?:\d\d\d\d|W\d\d\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?:\d\d(?:\d\d(?:[.,]\d+)?)?)?)([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/;

var tzRegex = /Z|[+-]\d\d(?::?\d\d)?/;

var isoDates = [
    ['YYYYYY-MM-DD', /[+-]\d{6}-\d\d-\d\d/],
    ['YYYY-MM-DD', /\d{4}-\d\d-\d\d/],
    ['GGGG-[W]WW-E', /\d{4}-W\d\d-\d/],
    ['GGGG-[W]WW', /\d{4}-W\d\d/, false],
    ['YYYY-DDD', /\d{4}-\d{3}/],
    ['YYYY-MM', /\d{4}-\d\d/, false],
    ['YYYYYYMMDD', /[+-]\d{10}/],
    ['YYYYMMDD', /\d{8}/],
    // YYYYMM is NOT allowed by the standard
    ['GGGG[W]WWE', /\d{4}W\d{3}/],
    ['GGGG[W]WW', /\d{4}W\d{2}/, false],
    ['YYYYDDD', /\d{7}/]
];

// iso time formats and regexes
var isoTimes = [
    ['HH:mm:ss.SSSS', /\d\d:\d\d:\d\d\.\d+/],
    ['HH:mm:ss,SSSS', /\d\d:\d\d:\d\d,\d+/],
    ['HH:mm:ss', /\d\d:\d\d:\d\d/],
    ['HH:mm', /\d\d:\d\d/],
    ['HHmmss.SSSS', /\d\d\d\d\d\d\.\d+/],
    ['HHmmss,SSSS', /\d\d\d\d\d\d,\d+/],
    ['HHmmss', /\d\d\d\d\d\d/],
    ['HHmm', /\d\d\d\d/],
    ['HH', /\d\d/]
];

var aspNetJsonRegex = /^\/?Date\((\-?\d+)/i;

// date from iso format
function configFromISO(config) {
    var i, l,
        string = config._i,
        match = extendedIsoRegex.exec(string) || basicIsoRegex.exec(string),
        allowTime, dateFormat, timeFormat, tzFormat;

    if (match) {
        getParsingFlags(config).iso = true;

        for (i = 0, l = isoDates.length; i < l; i++) {
            if (isoDates[i][1].exec(match[1])) {
                dateFormat = isoDates[i][0];
                allowTime = isoDates[i][2] !== false;
                break;
            }
        }
        if (dateFormat == null) {
            config._isValid = false;
            return;
        }
        if (match[3]) {
            for (i = 0, l = isoTimes.length; i < l; i++) {
                if (isoTimes[i][1].exec(match[3])) {
                    // match[2] should be 'T' or space
                    timeFormat = (match[2] || ' ') + isoTimes[i][0];
                    break;
                }
            }
            if (timeFormat == null) {
                config._isValid = false;
                return;
            }
        }
        if (!allowTime && timeFormat != null) {
            config._isValid = false;
            return;
        }
        if (match[4]) {
            if (tzRegex.exec(match[4])) {
                tzFormat = 'Z';
            } else {
                config._isValid = false;
                return;
            }
        }
        config._f = dateFormat + (timeFormat || '') + (tzFormat || '');
        configFromStringAndFormat(config);
    } else {
        config._isValid = false;
    }
}

// RFC 2822 regex: For details see https://tools.ietf.org/html/rfc2822#section-3.3
var rfc2822 = /^(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s)?(\d{1,2})\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(\d{2,4})\s(\d\d):(\d\d)(?::(\d\d))?\s(?:(UT|GMT|[ECMP][SD]T)|([Zz])|([+-]\d{4}))$/;

function extractFromRFC2822Strings(yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr) {
    var result = [
        untruncateYear(yearStr),
        defaultLocaleMonthsShort.indexOf(monthStr),
        parseInt(dayStr, 10),
        parseInt(hourStr, 10),
        parseInt(minuteStr, 10)
    ];

    if (secondStr) {
        result.push(parseInt(secondStr, 10));
    }

    return result;
}

function untruncateYear(yearStr) {
    var year = parseInt(yearStr, 10);
    if (year <= 49) {
        return 2000 + year;
    } else if (year <= 999) {
        return 1900 + year;
    }
    return year;
}

function preprocessRFC2822(s) {
    // Remove comments and folding whitespace and replace multiple-spaces with a single space
    return s.replace(/\([^)]*\)|[\n\t]/g, ' ').replace(/(\s\s+)/g, ' ').trim();
}

function checkWeekday(weekdayStr, parsedInput, config) {
    if (weekdayStr) {
        // TODO: Replace the vanilla JS Date object with an indepentent day-of-week check.
        var weekdayProvided = defaultLocaleWeekdaysShort.indexOf(weekdayStr),
            weekdayActual = new Date(parsedInput[0], parsedInput[1], parsedInput[2]).getDay();
        if (weekdayProvided !== weekdayActual) {
            getParsingFlags(config).weekdayMismatch = true;
            config._isValid = false;
            return false;
        }
    }
    return true;
}

var obsOffsets = {
    UT: 0,
    GMT: 0,
    EDT: -4 * 60,
    EST: -5 * 60,
    CDT: -5 * 60,
    CST: -6 * 60,
    MDT: -6 * 60,
    MST: -7 * 60,
    PDT: -7 * 60,
    PST: -8 * 60
};

function calculateOffset(obsOffset, militaryOffset, numOffset) {
    if (obsOffset) {
        return obsOffsets[obsOffset];
    } else if (militaryOffset) {
        // the only allowed military tz is Z
        return 0;
    } else {
        var hm = parseInt(numOffset, 10);
        var m = hm % 100, h = (hm - m) / 100;
        return h * 60 + m;
    }
}

// date and time from ref 2822 format
function configFromRFC2822(config) {
    var match = rfc2822.exec(preprocessRFC2822(config._i));
    if (match) {
        var parsedArray = extractFromRFC2822Strings(match[4], match[3], match[2], match[5], match[6], match[7]);
        if (!checkWeekday(match[1], parsedArray, config)) {
            return;
        }

        config._a = parsedArray;
        config._tzm = calculateOffset(match[8], match[9], match[10]);

        config._d = createUTCDate.apply(null, config._a);
        config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);

        getParsingFlags(config).rfc2822 = true;
    } else {
        config._isValid = false;
    }
}

// date from iso format or fallback
function configFromString(config) {
    var matched = aspNetJsonRegex.exec(config._i);

    if (matched !== null) {
        config._d = new Date(+matched[1]);
        return;
    }

    configFromISO(config);
    if (config._isValid === false) {
        delete config._isValid;
    } else {
        return;
    }

    configFromRFC2822(config);
    if (config._isValid === false) {
        delete config._isValid;
    } else {
        return;
    }

    // Final attempt, use Input Fallback
    hooks.createFromInputFallback(config);
}

hooks.createFromInputFallback = deprecate(
    'value provided is not in a recognized RFC2822 or ISO format. moment construction falls back to js Date(), ' +
    'which is not reliable across all browsers and versions. Non RFC2822/ISO date formats are ' +
    'discouraged and will be removed in an upcoming major release. Please refer to ' +
    'http://momentjs.com/guides/#/warnings/js-date/ for more info.',
    function (config) {
        config._d = new Date(config._i + (config._useUTC ? ' UTC' : ''));
    }
);

// constant that refers to the ISO standard
hooks.ISO_8601 = function () {};

// constant that refers to the RFC 2822 form
hooks.RFC_2822 = function () {};

// date from string and format string
function configFromStringAndFormat(config) {
    // TODO: Move this to another part of the creation flow to prevent circular deps
    if (config._f === hooks.ISO_8601) {
        configFromISO(config);
        return;
    }
    if (config._f === hooks.RFC_2822) {
        configFromRFC2822(config);
        return;
    }
    config._a = [];
    getParsingFlags(config).empty = true;

    // This array is used to make a Date, either with `new Date` or `Date.UTC`
    var string = '' + config._i,
        i, parsedInput, tokens, token, skipped,
        stringLength = string.length,
        totalParsedInputLength = 0;

    tokens = expandFormat(config._f, config._locale).match(formattingTokens) || [];

    for (i = 0; i < tokens.length; i++) {
        token = tokens[i];
        parsedInput = (string.match(getParseRegexForToken(token, config)) || [])[0];
        // console.log('token', token, 'parsedInput', parsedInput,
        //         'regex', getParseRegexForToken(token, config));
        if (parsedInput) {
            skipped = string.substr(0, string.indexOf(parsedInput));
            if (skipped.length > 0) {
                getParsingFlags(config).unusedInput.push(skipped);
            }
            string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
            totalParsedInputLength += parsedInput.length;
        }
        // don't parse if it's not a known token
        if (formatTokenFunctions[token]) {
            if (parsedInput) {
                getParsingFlags(config).empty = false;
            }
            else {
                getParsingFlags(config).unusedTokens.push(token);
            }
            addTimeToArrayFromToken(token, parsedInput, config);
        }
        else if (config._strict && !parsedInput) {
            getParsingFlags(config).unusedTokens.push(token);
        }
    }

    // add remaining unparsed input length to the string
    getParsingFlags(config).charsLeftOver = stringLength - totalParsedInputLength;
    if (string.length > 0) {
        getParsingFlags(config).unusedInput.push(string);
    }

    // clear _12h flag if hour is <= 12
    if (config._a[HOUR] <= 12 &&
        getParsingFlags(config).bigHour === true &&
        config._a[HOUR] > 0) {
        getParsingFlags(config).bigHour = undefined;
    }

    getParsingFlags(config).parsedDateParts = config._a.slice(0);
    getParsingFlags(config).meridiem = config._meridiem;
    // handle meridiem
    config._a[HOUR] = meridiemFixWrap(config._locale, config._a[HOUR], config._meridiem);

    configFromArray(config);
    checkOverflow(config);
}


function meridiemFixWrap (locale, hour, meridiem) {
    var isPm;

    if (meridiem == null) {
        // nothing to do
        return hour;
    }
    if (locale.meridiemHour != null) {
        return locale.meridiemHour(hour, meridiem);
    } else if (locale.isPM != null) {
        // Fallback
        isPm = locale.isPM(meridiem);
        if (isPm && hour < 12) {
            hour += 12;
        }
        if (!isPm && hour === 12) {
            hour = 0;
        }
        return hour;
    } else {
        // this is not supposed to happen
        return hour;
    }
}

// date from string and array of format strings
function configFromStringAndArray(config) {
    var tempConfig,
        bestMoment,

        scoreToBeat,
        i,
        currentScore;

    if (config._f.length === 0) {
        getParsingFlags(config).invalidFormat = true;
        config._d = new Date(NaN);
        return;
    }

    for (i = 0; i < config._f.length; i++) {
        currentScore = 0;
        tempConfig = copyConfig({}, config);
        if (config._useUTC != null) {
            tempConfig._useUTC = config._useUTC;
        }
        tempConfig._f = config._f[i];
        configFromStringAndFormat(tempConfig);

        if (!isValid(tempConfig)) {
            continue;
        }

        // if there is any input that was not parsed add a penalty for that format
        currentScore += getParsingFlags(tempConfig).charsLeftOver;

        //or tokens
        currentScore += getParsingFlags(tempConfig).unusedTokens.length * 10;

        getParsingFlags(tempConfig).score = currentScore;

        if (scoreToBeat == null || currentScore < scoreToBeat) {
            scoreToBeat = currentScore;
            bestMoment = tempConfig;
        }
    }

    extend(config, bestMoment || tempConfig);
}

function configFromObject(config) {
    if (config._d) {
        return;
    }

    var i = normalizeObjectUnits(config._i);
    config._a = map([i.year, i.month, i.day || i.date, i.hour, i.minute, i.second, i.millisecond], function (obj) {
        return obj && parseInt(obj, 10);
    });

    configFromArray(config);
}

function createFromConfig (config) {
    var res = new Moment(checkOverflow(prepareConfig(config)));
    if (res._nextDay) {
        // Adding is smart enough around DST
        res.add(1, 'd');
        res._nextDay = undefined;
    }

    return res;
}

function prepareConfig (config) {
    var input = config._i,
        format = config._f;

    config._locale = config._locale || getLocale(config._l);

    if (input === null || (format === undefined && input === '')) {
        return createInvalid({nullInput: true});
    }

    if (typeof input === 'string') {
        config._i = input = config._locale.preparse(input);
    }

    if (isMoment(input)) {
        return new Moment(checkOverflow(input));
    } else if (isDate(input)) {
        config._d = input;
    } else if (isArray(format)) {
        configFromStringAndArray(config);
    } else if (format) {
        configFromStringAndFormat(config);
    }  else {
        configFromInput(config);
    }

    if (!isValid(config)) {
        config._d = null;
    }

    return config;
}

function configFromInput(config) {
    var input = config._i;
    if (isUndefined(input)) {
        config._d = new Date(hooks.now());
    } else if (isDate(input)) {
        config._d = new Date(input.valueOf());
    } else if (typeof input === 'string') {
        configFromString(config);
    } else if (isArray(input)) {
        config._a = map(input.slice(0), function (obj) {
            return parseInt(obj, 10);
        });
        configFromArray(config);
    } else if (isObject(input)) {
        configFromObject(config);
    } else if (isNumber(input)) {
        // from milliseconds
        config._d = new Date(input);
    } else {
        hooks.createFromInputFallback(config);
    }
}

function createLocalOrUTC (input, format, locale, strict, isUTC) {
    var c = {};

    if (locale === true || locale === false) {
        strict = locale;
        locale = undefined;
    }

    if ((isObject(input) && isObjectEmpty(input)) ||
            (isArray(input) && input.length === 0)) {
        input = undefined;
    }
    // object construction must be done this way.
    // https://github.com/moment/moment/issues/1423
    c._isAMomentObject = true;
    c._useUTC = c._isUTC = isUTC;
    c._l = locale;
    c._i = input;
    c._f = format;
    c._strict = strict;

    return createFromConfig(c);
}

function createLocal (input, format, locale, strict) {
    return createLocalOrUTC(input, format, locale, strict, false);
}

var prototypeMin = deprecate(
    'moment().min is deprecated, use moment.max instead. http://momentjs.com/guides/#/warnings/min-max/',
    function () {
        var other = createLocal.apply(null, arguments);
        if (this.isValid() && other.isValid()) {
            return other < this ? this : other;
        } else {
            return createInvalid();
        }
    }
);

var prototypeMax = deprecate(
    'moment().max is deprecated, use moment.min instead. http://momentjs.com/guides/#/warnings/min-max/',
    function () {
        var other = createLocal.apply(null, arguments);
        if (this.isValid() && other.isValid()) {
            return other > this ? this : other;
        } else {
            return createInvalid();
        }
    }
);

// Pick a moment m from moments so that m[fn](other) is true for all
// other. This relies on the function fn to be transitive.
//
// moments should either be an array of moment objects or an array, whose
// first element is an array of moment objects.
function pickBy(fn, moments) {
    var res, i;
    if (moments.length === 1 && isArray(moments[0])) {
        moments = moments[0];
    }
    if (!moments.length) {
        return createLocal();
    }
    res = moments[0];
    for (i = 1; i < moments.length; ++i) {
        if (!moments[i].isValid() || moments[i][fn](res)) {
            res = moments[i];
        }
    }
    return res;
}

// TODO: Use [].sort instead?
function min () {
    var args = [].slice.call(arguments, 0);

    return pickBy('isBefore', args);
}

function max () {
    var args = [].slice.call(arguments, 0);

    return pickBy('isAfter', args);
}

var now = function () {
    return Date.now ? Date.now() : +(new Date());
};

var ordering = ['year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second', 'millisecond'];

function isDurationValid(m) {
    for (var key in m) {
        if (!(indexOf.call(ordering, key) !== -1 && (m[key] == null || !isNaN(m[key])))) {
            return false;
        }
    }

    var unitHasDecimal = false;
    for (var i = 0; i < ordering.length; ++i) {
        if (m[ordering[i]]) {
            if (unitHasDecimal) {
                return false; // only allow non-integers for smallest unit
            }
            if (parseFloat(m[ordering[i]]) !== toInt(m[ordering[i]])) {
                unitHasDecimal = true;
            }
        }
    }

    return true;
}

function isValid$1() {
    return this._isValid;
}

function createInvalid$1() {
    return createDuration(NaN);
}

function Duration (duration) {
    var normalizedInput = normalizeObjectUnits(duration),
        years = normalizedInput.year || 0,
        quarters = normalizedInput.quarter || 0,
        months = normalizedInput.month || 0,
        weeks = normalizedInput.week || 0,
        days = normalizedInput.day || 0,
        hours = normalizedInput.hour || 0,
        minutes = normalizedInput.minute || 0,
        seconds = normalizedInput.second || 0,
        milliseconds = normalizedInput.millisecond || 0;

    this._isValid = isDurationValid(normalizedInput);

    // representation for dateAddRemove
    this._milliseconds = +milliseconds +
        seconds * 1e3 + // 1000
        minutes * 6e4 + // 1000 * 60
        hours * 1000 * 60 * 60; //using 1000 * 60 * 60 instead of 36e5 to avoid floating point rounding errors https://github.com/moment/moment/issues/2978
    // Because of dateAddRemove treats 24 hours as different from a
    // day when working around DST, we need to store them separately
    this._days = +days +
        weeks * 7;
    // It is impossible to translate months into days without knowing
    // which months you are are talking about, so we have to store
    // it separately.
    this._months = +months +
        quarters * 3 +
        years * 12;

    this._data = {};

    this._locale = getLocale();

    this._bubble();
}

function isDuration (obj) {
    return obj instanceof Duration;
}

function absRound (number) {
    if (number < 0) {
        return Math.round(-1 * number) * -1;
    } else {
        return Math.round(number);
    }
}

// FORMATTING

function offset (token, separator) {
    addFormatToken(token, 0, 0, function () {
        var offset = this.utcOffset();
        var sign = '+';
        if (offset < 0) {
            offset = -offset;
            sign = '-';
        }
        return sign + zeroFill(~~(offset / 60), 2) + separator + zeroFill(~~(offset) % 60, 2);
    });
}

offset('Z', ':');
offset('ZZ', '');

// PARSING

addRegexToken('Z',  matchShortOffset);
addRegexToken('ZZ', matchShortOffset);
addParseToken(['Z', 'ZZ'], function (input, array, config) {
    config._useUTC = true;
    config._tzm = offsetFromString(matchShortOffset, input);
});

// HELPERS

// timezone chunker
// '+10:00' > ['10',  '00']
// '-1530'  > ['-15', '30']
var chunkOffset = /([\+\-]|\d\d)/gi;

function offsetFromString(matcher, string) {
    var matches = (string || '').match(matcher);

    if (matches === null) {
        return null;
    }

    var chunk   = matches[matches.length - 1] || [];
    var parts   = (chunk + '').match(chunkOffset) || ['-', 0, 0];
    var minutes = +(parts[1] * 60) + toInt(parts[2]);

    return minutes === 0 ?
      0 :
      parts[0] === '+' ? minutes : -minutes;
}

// Return a moment from input, that is local/utc/zone equivalent to model.
function cloneWithOffset(input, model) {
    var res, diff;
    if (model._isUTC) {
        res = model.clone();
        diff = (isMoment(input) || isDate(input) ? input.valueOf() : createLocal(input).valueOf()) - res.valueOf();
        // Use low-level api, because this fn is low-level api.
        res._d.setTime(res._d.valueOf() + diff);
        hooks.updateOffset(res, false);
        return res;
    } else {
        return createLocal(input).local();
    }
}

function getDateOffset (m) {
    // On Firefox.24 Date#getTimezoneOffset returns a floating point.
    // https://github.com/moment/moment/pull/1871
    return -Math.round(m._d.getTimezoneOffset() / 15) * 15;
}

// HOOKS

// This function will be called whenever a moment is mutated.
// It is intended to keep the offset in sync with the timezone.
hooks.updateOffset = function () {};

// MOMENTS

// keepLocalTime = true means only change the timezone, without
// affecting the local hour. So 5:31:26 +0300 --[utcOffset(2, true)]-->
// 5:31:26 +0200 It is possible that 5:31:26 doesn't exist with offset
// +0200, so we adjust the time as needed, to be valid.
//
// Keeping the time actually adds/subtracts (one hour)
// from the actual represented time. That is why we call updateOffset
// a second time. In case it wants us to change the offset again
// _changeInProgress == true case, then we have to adjust, because
// there is no such time in the given timezone.
function getSetOffset (input, keepLocalTime, keepMinutes) {
    var offset = this._offset || 0,
        localAdjust;
    if (!this.isValid()) {
        return input != null ? this : NaN;
    }
    if (input != null) {
        if (typeof input === 'string') {
            input = offsetFromString(matchShortOffset, input);
            if (input === null) {
                return this;
            }
        } else if (Math.abs(input) < 16 && !keepMinutes) {
            input = input * 60;
        }
        if (!this._isUTC && keepLocalTime) {
            localAdjust = getDateOffset(this);
        }
        this._offset = input;
        this._isUTC = true;
        if (localAdjust != null) {
            this.add(localAdjust, 'm');
        }
        if (offset !== input) {
            if (!keepLocalTime || this._changeInProgress) {
                addSubtract(this, createDuration(input - offset, 'm'), 1, false);
            } else if (!this._changeInProgress) {
                this._changeInProgress = true;
                hooks.updateOffset(this, true);
                this._changeInProgress = null;
            }
        }
        return this;
    } else {
        return this._isUTC ? offset : getDateOffset(this);
    }
}

function getSetZone (input, keepLocalTime) {
    if (input != null) {
        if (typeof input !== 'string') {
            input = -input;
        }

        this.utcOffset(input, keepLocalTime);

        return this;
    } else {
        return -this.utcOffset();
    }
}

function setOffsetToUTC (keepLocalTime) {
    return this.utcOffset(0, keepLocalTime);
}

function setOffsetToLocal (keepLocalTime) {
    if (this._isUTC) {
        this.utcOffset(0, keepLocalTime);
        this._isUTC = false;

        if (keepLocalTime) {
            this.subtract(getDateOffset(this), 'm');
        }
    }
    return this;
}

function setOffsetToParsedOffset () {
    if (this._tzm != null) {
        this.utcOffset(this._tzm, false, true);
    } else if (typeof this._i === 'string') {
        var tZone = offsetFromString(matchOffset, this._i);
        if (tZone != null) {
            this.utcOffset(tZone);
        }
        else {
            this.utcOffset(0, true);
        }
    }
    return this;
}

function hasAlignedHourOffset (input) {
    if (!this.isValid()) {
        return false;
    }
    input = input ? createLocal(input).utcOffset() : 0;

    return (this.utcOffset() - input) % 60 === 0;
}

function isDaylightSavingTime () {
    return (
        this.utcOffset() > this.clone().month(0).utcOffset() ||
        this.utcOffset() > this.clone().month(5).utcOffset()
    );
}

function isDaylightSavingTimeShifted () {
    if (!isUndefined(this._isDSTShifted)) {
        return this._isDSTShifted;
    }

    var c = {};

    copyConfig(c, this);
    c = prepareConfig(c);

    if (c._a) {
        var other = c._isUTC ? createUTC(c._a) : createLocal(c._a);
        this._isDSTShifted = this.isValid() &&
            compareArrays(c._a, other.toArray()) > 0;
    } else {
        this._isDSTShifted = false;
    }

    return this._isDSTShifted;
}

function isLocal () {
    return this.isValid() ? !this._isUTC : false;
}

function isUtcOffset () {
    return this.isValid() ? this._isUTC : false;
}

function isUtc () {
    return this.isValid() ? this._isUTC && this._offset === 0 : false;
}

// ASP.NET json date format regex
var aspNetRegex = /^(\-|\+)?(?:(\d*)[. ])?(\d+)\:(\d+)(?:\:(\d+)(\.\d*)?)?$/;

// from http://docs.closure-library.googlecode.com/git/closure_goog_date_date.js.source.html
// somewhat more in line with 4.4.3.2 2004 spec, but allows decimal anywhere
// and further modified to allow for strings containing both week and day
var isoRegex = /^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/;

function createDuration (input, key) {
    var duration = input,
        // matching against regexp is expensive, do it on demand
        match = null,
        sign,
        ret,
        diffRes;

    if (isDuration(input)) {
        duration = {
            ms : input._milliseconds,
            d  : input._days,
            M  : input._months
        };
    } else if (isNumber(input)) {
        duration = {};
        if (key) {
            duration[key] = input;
        } else {
            duration.milliseconds = input;
        }
    } else if (!!(match = aspNetRegex.exec(input))) {
        sign = (match[1] === '-') ? -1 : 1;
        duration = {
            y  : 0,
            d  : toInt(match[DATE])                         * sign,
            h  : toInt(match[HOUR])                         * sign,
            m  : toInt(match[MINUTE])                       * sign,
            s  : toInt(match[SECOND])                       * sign,
            ms : toInt(absRound(match[MILLISECOND] * 1000)) * sign // the millisecond decimal point is included in the match
        };
    } else if (!!(match = isoRegex.exec(input))) {
        sign = (match[1] === '-') ? -1 : (match[1] === '+') ? 1 : 1;
        duration = {
            y : parseIso(match[2], sign),
            M : parseIso(match[3], sign),
            w : parseIso(match[4], sign),
            d : parseIso(match[5], sign),
            h : parseIso(match[6], sign),
            m : parseIso(match[7], sign),
            s : parseIso(match[8], sign)
        };
    } else if (duration == null) {// checks for null or undefined
        duration = {};
    } else if (typeof duration === 'object' && ('from' in duration || 'to' in duration)) {
        diffRes = momentsDifference(createLocal(duration.from), createLocal(duration.to));

        duration = {};
        duration.ms = diffRes.milliseconds;
        duration.M = diffRes.months;
    }

    ret = new Duration(duration);

    if (isDuration(input) && hasOwnProp(input, '_locale')) {
        ret._locale = input._locale;
    }

    return ret;
}

createDuration.fn = Duration.prototype;
createDuration.invalid = createInvalid$1;

function parseIso (inp, sign) {
    // We'd normally use ~~inp for this, but unfortunately it also
    // converts floats to ints.
    // inp may be undefined, so careful calling replace on it.
    var res = inp && parseFloat(inp.replace(',', '.'));
    // apply sign while we're at it
    return (isNaN(res) ? 0 : res) * sign;
}

function positiveMomentsDifference(base, other) {
    var res = {milliseconds: 0, months: 0};

    res.months = other.month() - base.month() +
        (other.year() - base.year()) * 12;
    if (base.clone().add(res.months, 'M').isAfter(other)) {
        --res.months;
    }

    res.milliseconds = +other - +(base.clone().add(res.months, 'M'));

    return res;
}

function momentsDifference(base, other) {
    var res;
    if (!(base.isValid() && other.isValid())) {
        return {milliseconds: 0, months: 0};
    }

    other = cloneWithOffset(other, base);
    if (base.isBefore(other)) {
        res = positiveMomentsDifference(base, other);
    } else {
        res = positiveMomentsDifference(other, base);
        res.milliseconds = -res.milliseconds;
        res.months = -res.months;
    }

    return res;
}

// TODO: remove 'name' arg after deprecation is removed
function createAdder(direction, name) {
    return function (val, period) {
        var dur, tmp;
        //invert the arguments, but complain about it
        if (period !== null && !isNaN(+period)) {
            deprecateSimple(name, 'moment().' + name  + '(period, number) is deprecated. Please use moment().' + name + '(number, period). ' +
            'See http://momentjs.com/guides/#/warnings/add-inverted-param/ for more info.');
            tmp = val; val = period; period = tmp;
        }

        val = typeof val === 'string' ? +val : val;
        dur = createDuration(val, period);
        addSubtract(this, dur, direction);
        return this;
    };
}

function addSubtract (mom, duration, isAdding, updateOffset) {
    var milliseconds = duration._milliseconds,
        days = absRound(duration._days),
        months = absRound(duration._months);

    if (!mom.isValid()) {
        // No op
        return;
    }

    updateOffset = updateOffset == null ? true : updateOffset;

    if (months) {
        setMonth(mom, get(mom, 'Month') + months * isAdding);
    }
    if (days) {
        set$1(mom, 'Date', get(mom, 'Date') + days * isAdding);
    }
    if (milliseconds) {
        mom._d.setTime(mom._d.valueOf() + milliseconds * isAdding);
    }
    if (updateOffset) {
        hooks.updateOffset(mom, days || months);
    }
}

var add      = createAdder(1, 'add');
var subtract = createAdder(-1, 'subtract');

function getCalendarFormat(myMoment, now) {
    var diff = myMoment.diff(now, 'days', true);
    return diff < -6 ? 'sameElse' :
            diff < -1 ? 'lastWeek' :
            diff < 0 ? 'lastDay' :
            diff < 1 ? 'sameDay' :
            diff < 2 ? 'nextDay' :
            diff < 7 ? 'nextWeek' : 'sameElse';
}

function calendar$1 (time, formats) {
    // We want to compare the start of today, vs this.
    // Getting start-of-today depends on whether we're local/utc/offset or not.
    var now = time || createLocal(),
        sod = cloneWithOffset(now, this).startOf('day'),
        format = hooks.calendarFormat(this, sod) || 'sameElse';

    var output = formats && (isFunction(formats[format]) ? formats[format].call(this, now) : formats[format]);

    return this.format(output || this.localeData().calendar(format, this, createLocal(now)));
}

function clone () {
    return new Moment(this);
}

function isAfter (input, units) {
    var localInput = isMoment(input) ? input : createLocal(input);
    if (!(this.isValid() && localInput.isValid())) {
        return false;
    }
    units = normalizeUnits(!isUndefined(units) ? units : 'millisecond');
    if (units === 'millisecond') {
        return this.valueOf() > localInput.valueOf();
    } else {
        return localInput.valueOf() < this.clone().startOf(units).valueOf();
    }
}

function isBefore (input, units) {
    var localInput = isMoment(input) ? input : createLocal(input);
    if (!(this.isValid() && localInput.isValid())) {
        return false;
    }
    units = normalizeUnits(!isUndefined(units) ? units : 'millisecond');
    if (units === 'millisecond') {
        return this.valueOf() < localInput.valueOf();
    } else {
        return this.clone().endOf(units).valueOf() < localInput.valueOf();
    }
}

function isBetween (from, to, units, inclusivity) {
    inclusivity = inclusivity || '()';
    return (inclusivity[0] === '(' ? this.isAfter(from, units) : !this.isBefore(from, units)) &&
        (inclusivity[1] === ')' ? this.isBefore(to, units) : !this.isAfter(to, units));
}

function isSame (input, units) {
    var localInput = isMoment(input) ? input : createLocal(input),
        inputMs;
    if (!(this.isValid() && localInput.isValid())) {
        return false;
    }
    units = normalizeUnits(units || 'millisecond');
    if (units === 'millisecond') {
        return this.valueOf() === localInput.valueOf();
    } else {
        inputMs = localInput.valueOf();
        return this.clone().startOf(units).valueOf() <= inputMs && inputMs <= this.clone().endOf(units).valueOf();
    }
}

function isSameOrAfter (input, units) {
    return this.isSame(input, units) || this.isAfter(input,units);
}

function isSameOrBefore (input, units) {
    return this.isSame(input, units) || this.isBefore(input,units);
}

function diff (input, units, asFloat) {
    var that,
        zoneDelta,
        output;

    if (!this.isValid()) {
        return NaN;
    }

    that = cloneWithOffset(input, this);

    if (!that.isValid()) {
        return NaN;
    }

    zoneDelta = (that.utcOffset() - this.utcOffset()) * 6e4;

    units = normalizeUnits(units);

    switch (units) {
        case 'year': output = monthDiff(this, that) / 12; break;
        case 'month': output = monthDiff(this, that); break;
        case 'quarter': output = monthDiff(this, that) / 3; break;
        case 'second': output = (this - that) / 1e3; break; // 1000
        case 'minute': output = (this - that) / 6e4; break; // 1000 * 60
        case 'hour': output = (this - that) / 36e5; break; // 1000 * 60 * 60
        case 'day': output = (this - that - zoneDelta) / 864e5; break; // 1000 * 60 * 60 * 24, negate dst
        case 'week': output = (this - that - zoneDelta) / 6048e5; break; // 1000 * 60 * 60 * 24 * 7, negate dst
        default: output = this - that;
    }

    return asFloat ? output : absFloor(output);
}

function monthDiff (a, b) {
    // difference in months
    var wholeMonthDiff = ((b.year() - a.year()) * 12) + (b.month() - a.month()),
        // b is in (anchor - 1 month, anchor + 1 month)
        anchor = a.clone().add(wholeMonthDiff, 'months'),
        anchor2, adjust;

    if (b - anchor < 0) {
        anchor2 = a.clone().add(wholeMonthDiff - 1, 'months');
        // linear across the month
        adjust = (b - anchor) / (anchor - anchor2);
    } else {
        anchor2 = a.clone().add(wholeMonthDiff + 1, 'months');
        // linear across the month
        adjust = (b - anchor) / (anchor2 - anchor);
    }

    //check for negative zero, return zero if negative zero
    return -(wholeMonthDiff + adjust) || 0;
}

hooks.defaultFormat = 'YYYY-MM-DDTHH:mm:ssZ';
hooks.defaultFormatUtc = 'YYYY-MM-DDTHH:mm:ss[Z]';

function toString () {
    return this.clone().locale('en').format('ddd MMM DD YYYY HH:mm:ss [GMT]ZZ');
}

function toISOString(keepOffset) {
    if (!this.isValid()) {
        return null;
    }
    var utc = keepOffset !== true;
    var m = utc ? this.clone().utc() : this;
    if (m.year() < 0 || m.year() > 9999) {
        return formatMoment(m, utc ? 'YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]' : 'YYYYYY-MM-DD[T]HH:mm:ss.SSSZ');
    }
    if (isFunction(Date.prototype.toISOString)) {
        // native implementation is ~50x faster, use it when we can
        if (utc) {
            return this.toDate().toISOString();
        } else {
            return new Date(this.valueOf() + this.utcOffset() * 60 * 1000).toISOString().replace('Z', formatMoment(m, 'Z'));
        }
    }
    return formatMoment(m, utc ? 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]' : 'YYYY-MM-DD[T]HH:mm:ss.SSSZ');
}

/**
 * Return a human readable representation of a moment that can
 * also be evaluated to get a new moment which is the same
 *
 * @link https://nodejs.org/dist/latest/docs/api/util.html#util_custom_inspect_function_on_objects
 */
function inspect () {
    if (!this.isValid()) {
        return 'moment.invalid(/* ' + this._i + ' */)';
    }
    var func = 'moment';
    var zone = '';
    if (!this.isLocal()) {
        func = this.utcOffset() === 0 ? 'moment.utc' : 'moment.parseZone';
        zone = 'Z';
    }
    var prefix = '[' + func + '("]';
    var year = (0 <= this.year() && this.year() <= 9999) ? 'YYYY' : 'YYYYYY';
    var datetime = '-MM-DD[T]HH:mm:ss.SSS';
    var suffix = zone + '[")]';

    return this.format(prefix + year + datetime + suffix);
}

function format (inputString) {
    if (!inputString) {
        inputString = this.isUtc() ? hooks.defaultFormatUtc : hooks.defaultFormat;
    }
    var output = formatMoment(this, inputString);
    return this.localeData().postformat(output);
}

function from (time, withoutSuffix) {
    if (this.isValid() &&
            ((isMoment(time) && time.isValid()) ||
             createLocal(time).isValid())) {
        return createDuration({to: this, from: time}).locale(this.locale()).humanize(!withoutSuffix);
    } else {
        return this.localeData().invalidDate();
    }
}

function fromNow (withoutSuffix) {
    return this.from(createLocal(), withoutSuffix);
}

function to (time, withoutSuffix) {
    if (this.isValid() &&
            ((isMoment(time) && time.isValid()) ||
             createLocal(time).isValid())) {
        return createDuration({from: this, to: time}).locale(this.locale()).humanize(!withoutSuffix);
    } else {
        return this.localeData().invalidDate();
    }
}

function toNow (withoutSuffix) {
    return this.to(createLocal(), withoutSuffix);
}

// If passed a locale key, it will set the locale for this
// instance.  Otherwise, it will return the locale configuration
// variables for this instance.
function locale (key) {
    var newLocaleData;

    if (key === undefined) {
        return this._locale._abbr;
    } else {
        newLocaleData = getLocale(key);
        if (newLocaleData != null) {
            this._locale = newLocaleData;
        }
        return this;
    }
}

var lang = deprecate(
    'moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.',
    function (key) {
        if (key === undefined) {
            return this.localeData();
        } else {
            return this.locale(key);
        }
    }
);

function localeData () {
    return this._locale;
}

function startOf (units) {
    units = normalizeUnits(units);
    // the following switch intentionally omits break keywords
    // to utilize falling through the cases.
    switch (units) {
        case 'year':
            this.month(0);
            /* falls through */
        case 'quarter':
        case 'month':
            this.date(1);
            /* falls through */
        case 'week':
        case 'isoWeek':
        case 'day':
        case 'date':
            this.hours(0);
            /* falls through */
        case 'hour':
            this.minutes(0);
            /* falls through */
        case 'minute':
            this.seconds(0);
            /* falls through */
        case 'second':
            this.milliseconds(0);
    }

    // weeks are a special case
    if (units === 'week') {
        this.weekday(0);
    }
    if (units === 'isoWeek') {
        this.isoWeekday(1);
    }

    // quarters are also special
    if (units === 'quarter') {
        this.month(Math.floor(this.month() / 3) * 3);
    }

    return this;
}

function endOf (units) {
    units = normalizeUnits(units);
    if (units === undefined || units === 'millisecond') {
        return this;
    }

    // 'date' is an alias for 'day', so it should be considered as such.
    if (units === 'date') {
        units = 'day';
    }

    return this.startOf(units).add(1, (units === 'isoWeek' ? 'week' : units)).subtract(1, 'ms');
}

function valueOf () {
    return this._d.valueOf() - ((this._offset || 0) * 60000);
}

function unix () {
    return Math.floor(this.valueOf() / 1000);
}

function toDate () {
    return new Date(this.valueOf());
}

function toArray () {
    var m = this;
    return [m.year(), m.month(), m.date(), m.hour(), m.minute(), m.second(), m.millisecond()];
}

function toObject () {
    var m = this;
    return {
        years: m.year(),
        months: m.month(),
        date: m.date(),
        hours: m.hours(),
        minutes: m.minutes(),
        seconds: m.seconds(),
        milliseconds: m.milliseconds()
    };
}

function toJSON () {
    // new Date(NaN).toJSON() === null
    return this.isValid() ? this.toISOString() : null;
}

function isValid$2 () {
    return isValid(this);
}

function parsingFlags () {
    return extend({}, getParsingFlags(this));
}

function invalidAt () {
    return getParsingFlags(this).overflow;
}

function creationData() {
    return {
        input: this._i,
        format: this._f,
        locale: this._locale,
        isUTC: this._isUTC,
        strict: this._strict
    };
}

// FORMATTING

addFormatToken(0, ['gg', 2], 0, function () {
    return this.weekYear() % 100;
});

addFormatToken(0, ['GG', 2], 0, function () {
    return this.isoWeekYear() % 100;
});

function addWeekYearFormatToken (token, getter) {
    addFormatToken(0, [token, token.length], 0, getter);
}

addWeekYearFormatToken('gggg',     'weekYear');
addWeekYearFormatToken('ggggg',    'weekYear');
addWeekYearFormatToken('GGGG',  'isoWeekYear');
addWeekYearFormatToken('GGGGG', 'isoWeekYear');

// ALIASES

addUnitAlias('weekYear', 'gg');
addUnitAlias('isoWeekYear', 'GG');

// PRIORITY

addUnitPriority('weekYear', 1);
addUnitPriority('isoWeekYear', 1);


// PARSING

addRegexToken('G',      matchSigned);
addRegexToken('g',      matchSigned);
addRegexToken('GG',     match1to2, match2);
addRegexToken('gg',     match1to2, match2);
addRegexToken('GGGG',   match1to4, match4);
addRegexToken('gggg',   match1to4, match4);
addRegexToken('GGGGG',  match1to6, match6);
addRegexToken('ggggg',  match1to6, match6);

addWeekParseToken(['gggg', 'ggggg', 'GGGG', 'GGGGG'], function (input, week, config, token) {
    week[token.substr(0, 2)] = toInt(input);
});

addWeekParseToken(['gg', 'GG'], function (input, week, config, token) {
    week[token] = hooks.parseTwoDigitYear(input);
});

// MOMENTS

function getSetWeekYear (input) {
    return getSetWeekYearHelper.call(this,
            input,
            this.week(),
            this.weekday(),
            this.localeData()._week.dow,
            this.localeData()._week.doy);
}

function getSetISOWeekYear (input) {
    return getSetWeekYearHelper.call(this,
            input, this.isoWeek(), this.isoWeekday(), 1, 4);
}

function getISOWeeksInYear () {
    return weeksInYear(this.year(), 1, 4);
}

function getWeeksInYear () {
    var weekInfo = this.localeData()._week;
    return weeksInYear(this.year(), weekInfo.dow, weekInfo.doy);
}

function getSetWeekYearHelper(input, week, weekday, dow, doy) {
    var weeksTarget;
    if (input == null) {
        return weekOfYear(this, dow, doy).year;
    } else {
        weeksTarget = weeksInYear(input, dow, doy);
        if (week > weeksTarget) {
            week = weeksTarget;
        }
        return setWeekAll.call(this, input, week, weekday, dow, doy);
    }
}

function setWeekAll(weekYear, week, weekday, dow, doy) {
    var dayOfYearData = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy),
        date = createUTCDate(dayOfYearData.year, 0, dayOfYearData.dayOfYear);

    this.year(date.getUTCFullYear());
    this.month(date.getUTCMonth());
    this.date(date.getUTCDate());
    return this;
}

// FORMATTING

addFormatToken('Q', 0, 'Qo', 'quarter');

// ALIASES

addUnitAlias('quarter', 'Q');

// PRIORITY

addUnitPriority('quarter', 7);

// PARSING

addRegexToken('Q', match1);
addParseToken('Q', function (input, array) {
    array[MONTH] = (toInt(input) - 1) * 3;
});

// MOMENTS

function getSetQuarter (input) {
    return input == null ? Math.ceil((this.month() + 1) / 3) : this.month((input - 1) * 3 + this.month() % 3);
}

// FORMATTING

addFormatToken('D', ['DD', 2], 'Do', 'date');

// ALIASES

addUnitAlias('date', 'D');

// PRIOROITY
addUnitPriority('date', 9);

// PARSING

addRegexToken('D',  match1to2);
addRegexToken('DD', match1to2, match2);
addRegexToken('Do', function (isStrict, locale) {
    // TODO: Remove "ordinalParse" fallback in next major release.
    return isStrict ?
      (locale._dayOfMonthOrdinalParse || locale._ordinalParse) :
      locale._dayOfMonthOrdinalParseLenient;
});

addParseToken(['D', 'DD'], DATE);
addParseToken('Do', function (input, array) {
    array[DATE] = toInt(input.match(match1to2)[0]);
});

// MOMENTS

var getSetDayOfMonth = makeGetSet('Date', true);

// FORMATTING

addFormatToken('DDD', ['DDDD', 3], 'DDDo', 'dayOfYear');

// ALIASES

addUnitAlias('dayOfYear', 'DDD');

// PRIORITY
addUnitPriority('dayOfYear', 4);

// PARSING

addRegexToken('DDD',  match1to3);
addRegexToken('DDDD', match3);
addParseToken(['DDD', 'DDDD'], function (input, array, config) {
    config._dayOfYear = toInt(input);
});

// HELPERS

// MOMENTS

function getSetDayOfYear (input) {
    var dayOfYear = Math.round((this.clone().startOf('day') - this.clone().startOf('year')) / 864e5) + 1;
    return input == null ? dayOfYear : this.add((input - dayOfYear), 'd');
}

// FORMATTING

addFormatToken('m', ['mm', 2], 0, 'minute');

// ALIASES

addUnitAlias('minute', 'm');

// PRIORITY

addUnitPriority('minute', 14);

// PARSING

addRegexToken('m',  match1to2);
addRegexToken('mm', match1to2, match2);
addParseToken(['m', 'mm'], MINUTE);

// MOMENTS

var getSetMinute = makeGetSet('Minutes', false);

// FORMATTING

addFormatToken('s', ['ss', 2], 0, 'second');

// ALIASES

addUnitAlias('second', 's');

// PRIORITY

addUnitPriority('second', 15);

// PARSING

addRegexToken('s',  match1to2);
addRegexToken('ss', match1to2, match2);
addParseToken(['s', 'ss'], SECOND);

// MOMENTS

var getSetSecond = makeGetSet('Seconds', false);

// FORMATTING

addFormatToken('S', 0, 0, function () {
    return ~~(this.millisecond() / 100);
});

addFormatToken(0, ['SS', 2], 0, function () {
    return ~~(this.millisecond() / 10);
});

addFormatToken(0, ['SSS', 3], 0, 'millisecond');
addFormatToken(0, ['SSSS', 4], 0, function () {
    return this.millisecond() * 10;
});
addFormatToken(0, ['SSSSS', 5], 0, function () {
    return this.millisecond() * 100;
});
addFormatToken(0, ['SSSSSS', 6], 0, function () {
    return this.millisecond() * 1000;
});
addFormatToken(0, ['SSSSSSS', 7], 0, function () {
    return this.millisecond() * 10000;
});
addFormatToken(0, ['SSSSSSSS', 8], 0, function () {
    return this.millisecond() * 100000;
});
addFormatToken(0, ['SSSSSSSSS', 9], 0, function () {
    return this.millisecond() * 1000000;
});


// ALIASES

addUnitAlias('millisecond', 'ms');

// PRIORITY

addUnitPriority('millisecond', 16);

// PARSING

addRegexToken('S',    match1to3, match1);
addRegexToken('SS',   match1to3, match2);
addRegexToken('SSS',  match1to3, match3);

var token;
for (token = 'SSSS'; token.length <= 9; token += 'S') {
    addRegexToken(token, matchUnsigned);
}

function parseMs(input, array) {
    array[MILLISECOND] = toInt(('0.' + input) * 1000);
}

for (token = 'S'; token.length <= 9; token += 'S') {
    addParseToken(token, parseMs);
}
// MOMENTS

var getSetMillisecond = makeGetSet('Milliseconds', false);

// FORMATTING

addFormatToken('z',  0, 0, 'zoneAbbr');
addFormatToken('zz', 0, 0, 'zoneName');

// MOMENTS

function getZoneAbbr () {
    return this._isUTC ? 'UTC' : '';
}

function getZoneName () {
    return this._isUTC ? 'Coordinated Universal Time' : '';
}

var proto = Moment.prototype;

proto.add               = add;
proto.calendar          = calendar$1;
proto.clone             = clone;
proto.diff              = diff;
proto.endOf             = endOf;
proto.format            = format;
proto.from              = from;
proto.fromNow           = fromNow;
proto.to                = to;
proto.toNow             = toNow;
proto.get               = stringGet;
proto.invalidAt         = invalidAt;
proto.isAfter           = isAfter;
proto.isBefore          = isBefore;
proto.isBetween         = isBetween;
proto.isSame            = isSame;
proto.isSameOrAfter     = isSameOrAfter;
proto.isSameOrBefore    = isSameOrBefore;
proto.isValid           = isValid$2;
proto.lang              = lang;
proto.locale            = locale;
proto.localeData        = localeData;
proto.max               = prototypeMax;
proto.min               = prototypeMin;
proto.parsingFlags      = parsingFlags;
proto.set               = stringSet;
proto.startOf           = startOf;
proto.subtract          = subtract;
proto.toArray           = toArray;
proto.toObject          = toObject;
proto.toDate            = toDate;
proto.toISOString       = toISOString;
proto.inspect           = inspect;
proto.toJSON            = toJSON;
proto.toString          = toString;
proto.unix              = unix;
proto.valueOf           = valueOf;
proto.creationData      = creationData;
proto.year       = getSetYear;
proto.isLeapYear = getIsLeapYear;
proto.weekYear    = getSetWeekYear;
proto.isoWeekYear = getSetISOWeekYear;
proto.quarter = proto.quarters = getSetQuarter;
proto.month       = getSetMonth;
proto.daysInMonth = getDaysInMonth;
proto.week           = proto.weeks        = getSetWeek;
proto.isoWeek        = proto.isoWeeks     = getSetISOWeek;
proto.weeksInYear    = getWeeksInYear;
proto.isoWeeksInYear = getISOWeeksInYear;
proto.date       = getSetDayOfMonth;
proto.day        = proto.days             = getSetDayOfWeek;
proto.weekday    = getSetLocaleDayOfWeek;
proto.isoWeekday = getSetISODayOfWeek;
proto.dayOfYear  = getSetDayOfYear;
proto.hour = proto.hours = getSetHour;
proto.minute = proto.minutes = getSetMinute;
proto.second = proto.seconds = getSetSecond;
proto.millisecond = proto.milliseconds = getSetMillisecond;
proto.utcOffset            = getSetOffset;
proto.utc                  = setOffsetToUTC;
proto.local                = setOffsetToLocal;
proto.parseZone            = setOffsetToParsedOffset;
proto.hasAlignedHourOffset = hasAlignedHourOffset;
proto.isDST                = isDaylightSavingTime;
proto.isLocal              = isLocal;
proto.isUtcOffset          = isUtcOffset;
proto.isUtc                = isUtc;
proto.isUTC                = isUtc;
proto.zoneAbbr = getZoneAbbr;
proto.zoneName = getZoneName;
proto.dates  = deprecate('dates accessor is deprecated. Use date instead.', getSetDayOfMonth);
proto.months = deprecate('months accessor is deprecated. Use month instead', getSetMonth);
proto.years  = deprecate('years accessor is deprecated. Use year instead', getSetYear);
proto.zone   = deprecate('moment().zone is deprecated, use moment().utcOffset instead. http://momentjs.com/guides/#/warnings/zone/', getSetZone);
proto.isDSTShifted = deprecate('isDSTShifted is deprecated. See http://momentjs.com/guides/#/warnings/dst-shifted/ for more information', isDaylightSavingTimeShifted);

function createUnix (input) {
    return createLocal(input * 1000);
}

function createInZone () {
    return createLocal.apply(null, arguments).parseZone();
}

function preParsePostFormat (string) {
    return string;
}

var proto$1 = Locale.prototype;

proto$1.calendar        = calendar;
proto$1.longDateFormat  = longDateFormat;
proto$1.invalidDate     = invalidDate;
proto$1.ordinal         = ordinal;
proto$1.preparse        = preParsePostFormat;
proto$1.postformat      = preParsePostFormat;
proto$1.relativeTime    = relativeTime;
proto$1.pastFuture      = pastFuture;
proto$1.set             = set;

proto$1.months            =        localeMonths;
proto$1.monthsShort       =        localeMonthsShort;
proto$1.monthsParse       =        localeMonthsParse;
proto$1.monthsRegex       = monthsRegex;
proto$1.monthsShortRegex  = monthsShortRegex;
proto$1.week = localeWeek;
proto$1.firstDayOfYear = localeFirstDayOfYear;
proto$1.firstDayOfWeek = localeFirstDayOfWeek;

proto$1.weekdays       =        localeWeekdays;
proto$1.weekdaysMin    =        localeWeekdaysMin;
proto$1.weekdaysShort  =        localeWeekdaysShort;
proto$1.weekdaysParse  =        localeWeekdaysParse;

proto$1.weekdaysRegex       =        weekdaysRegex;
proto$1.weekdaysShortRegex  =        weekdaysShortRegex;
proto$1.weekdaysMinRegex    =        weekdaysMinRegex;

proto$1.isPM = localeIsPM;
proto$1.meridiem = localeMeridiem;

function get$1 (format, index, field, setter) {
    var locale = getLocale();
    var utc = createUTC().set(setter, index);
    return locale[field](utc, format);
}

function listMonthsImpl (format, index, field) {
    if (isNumber(format)) {
        index = format;
        format = undefined;
    }

    format = format || '';

    if (index != null) {
        return get$1(format, index, field, 'month');
    }

    var i;
    var out = [];
    for (i = 0; i < 12; i++) {
        out[i] = get$1(format, i, field, 'month');
    }
    return out;
}

// ()
// (5)
// (fmt, 5)
// (fmt)
// (true)
// (true, 5)
// (true, fmt, 5)
// (true, fmt)
function listWeekdaysImpl (localeSorted, format, index, field) {
    if (typeof localeSorted === 'boolean') {
        if (isNumber(format)) {
            index = format;
            format = undefined;
        }

        format = format || '';
    } else {
        format = localeSorted;
        index = format;
        localeSorted = false;

        if (isNumber(format)) {
            index = format;
            format = undefined;
        }

        format = format || '';
    }

    var locale = getLocale(),
        shift = localeSorted ? locale._week.dow : 0;

    if (index != null) {
        return get$1(format, (index + shift) % 7, field, 'day');
    }

    var i;
    var out = [];
    for (i = 0; i < 7; i++) {
        out[i] = get$1(format, (i + shift) % 7, field, 'day');
    }
    return out;
}

function listMonths (format, index) {
    return listMonthsImpl(format, index, 'months');
}

function listMonthsShort (format, index) {
    return listMonthsImpl(format, index, 'monthsShort');
}

function listWeekdays (localeSorted, format, index) {
    return listWeekdaysImpl(localeSorted, format, index, 'weekdays');
}

function listWeekdaysShort (localeSorted, format, index) {
    return listWeekdaysImpl(localeSorted, format, index, 'weekdaysShort');
}

function listWeekdaysMin (localeSorted, format, index) {
    return listWeekdaysImpl(localeSorted, format, index, 'weekdaysMin');
}

getSetGlobalLocale('en', {
    dayOfMonthOrdinalParse: /\d{1,2}(th|st|nd|rd)/,
    ordinal : function (number) {
        var b = number % 10,
            output = (toInt(number % 100 / 10) === 1) ? 'th' :
            (b === 1) ? 'st' :
            (b === 2) ? 'nd' :
            (b === 3) ? 'rd' : 'th';
        return number + output;
    }
});

// Side effect imports

hooks.lang = deprecate('moment.lang is deprecated. Use moment.locale instead.', getSetGlobalLocale);
hooks.langData = deprecate('moment.langData is deprecated. Use moment.localeData instead.', getLocale);

var mathAbs = Math.abs;

function abs () {
    var data           = this._data;

    this._milliseconds = mathAbs(this._milliseconds);
    this._days         = mathAbs(this._days);
    this._months       = mathAbs(this._months);

    data.milliseconds  = mathAbs(data.milliseconds);
    data.seconds       = mathAbs(data.seconds);
    data.minutes       = mathAbs(data.minutes);
    data.hours         = mathAbs(data.hours);
    data.months        = mathAbs(data.months);
    data.years         = mathAbs(data.years);

    return this;
}

function addSubtract$1 (duration, input, value, direction) {
    var other = createDuration(input, value);

    duration._milliseconds += direction * other._milliseconds;
    duration._days         += direction * other._days;
    duration._months       += direction * other._months;

    return duration._bubble();
}

// supports only 2.0-style add(1, 's') or add(duration)
function add$1 (input, value) {
    return addSubtract$1(this, input, value, 1);
}

// supports only 2.0-style subtract(1, 's') or subtract(duration)
function subtract$1 (input, value) {
    return addSubtract$1(this, input, value, -1);
}

function absCeil (number) {
    if (number < 0) {
        return Math.floor(number);
    } else {
        return Math.ceil(number);
    }
}

function bubble () {
    var milliseconds = this._milliseconds;
    var days         = this._days;
    var months       = this._months;
    var data         = this._data;
    var seconds, minutes, hours, years, monthsFromDays;

    // if we have a mix of positive and negative values, bubble down first
    // check: https://github.com/moment/moment/issues/2166
    if (!((milliseconds >= 0 && days >= 0 && months >= 0) ||
            (milliseconds <= 0 && days <= 0 && months <= 0))) {
        milliseconds += absCeil(monthsToDays(months) + days) * 864e5;
        days = 0;
        months = 0;
    }

    // The following code bubbles up values, see the tests for
    // examples of what that means.
    data.milliseconds = milliseconds % 1000;

    seconds           = absFloor(milliseconds / 1000);
    data.seconds      = seconds % 60;

    minutes           = absFloor(seconds / 60);
    data.minutes      = minutes % 60;

    hours             = absFloor(minutes / 60);
    data.hours        = hours % 24;

    days += absFloor(hours / 24);

    // convert days to months
    monthsFromDays = absFloor(daysToMonths(days));
    months += monthsFromDays;
    days -= absCeil(monthsToDays(monthsFromDays));

    // 12 months -> 1 year
    years = absFloor(months / 12);
    months %= 12;

    data.days   = days;
    data.months = months;
    data.years  = years;

    return this;
}

function daysToMonths (days) {
    // 400 years have 146097 days (taking into account leap year rules)
    // 400 years have 12 months === 4800
    return days * 4800 / 146097;
}

function monthsToDays (months) {
    // the reverse of daysToMonths
    return months * 146097 / 4800;
}

function as (units) {
    if (!this.isValid()) {
        return NaN;
    }
    var days;
    var months;
    var milliseconds = this._milliseconds;

    units = normalizeUnits(units);

    if (units === 'month' || units === 'year') {
        days   = this._days   + milliseconds / 864e5;
        months = this._months + daysToMonths(days);
        return units === 'month' ? months : months / 12;
    } else {
        // handle milliseconds separately because of floating point math errors (issue #1867)
        days = this._days + Math.round(monthsToDays(this._months));
        switch (units) {
            case 'week'   : return days / 7     + milliseconds / 6048e5;
            case 'day'    : return days         + milliseconds / 864e5;
            case 'hour'   : return days * 24    + milliseconds / 36e5;
            case 'minute' : return days * 1440  + milliseconds / 6e4;
            case 'second' : return days * 86400 + milliseconds / 1000;
            // Math.floor prevents floating point math errors here
            case 'millisecond': return Math.floor(days * 864e5) + milliseconds;
            default: throw new Error('Unknown unit ' + units);
        }
    }
}

// TODO: Use this.as('ms')?
function valueOf$1 () {
    if (!this.isValid()) {
        return NaN;
    }
    return (
        this._milliseconds +
        this._days * 864e5 +
        (this._months % 12) * 2592e6 +
        toInt(this._months / 12) * 31536e6
    );
}

function makeAs (alias) {
    return function () {
        return this.as(alias);
    };
}

var asMilliseconds = makeAs('ms');
var asSeconds      = makeAs('s');
var asMinutes      = makeAs('m');
var asHours        = makeAs('h');
var asDays         = makeAs('d');
var asWeeks        = makeAs('w');
var asMonths       = makeAs('M');
var asYears        = makeAs('y');

function clone$1 () {
    return createDuration(this);
}

function get$2 (units) {
    units = normalizeUnits(units);
    return this.isValid() ? this[units + 's']() : NaN;
}

function makeGetter(name) {
    return function () {
        return this.isValid() ? this._data[name] : NaN;
    };
}

var milliseconds = makeGetter('milliseconds');
var seconds      = makeGetter('seconds');
var minutes      = makeGetter('minutes');
var hours        = makeGetter('hours');
var days         = makeGetter('days');
var months       = makeGetter('months');
var years        = makeGetter('years');

function weeks () {
    return absFloor(this.days() / 7);
}

var round = Math.round;
var thresholds = {
    ss: 44,         // a few seconds to seconds
    s : 45,         // seconds to minute
    m : 45,         // minutes to hour
    h : 22,         // hours to day
    d : 26,         // days to month
    M : 11          // months to year
};

// helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
function substituteTimeAgo(string, number, withoutSuffix, isFuture, locale) {
    return locale.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
}

function relativeTime$1 (posNegDuration, withoutSuffix, locale) {
    var duration = createDuration(posNegDuration).abs();
    var seconds  = round(duration.as('s'));
    var minutes  = round(duration.as('m'));
    var hours    = round(duration.as('h'));
    var days     = round(duration.as('d'));
    var months   = round(duration.as('M'));
    var years    = round(duration.as('y'));

    var a = seconds <= thresholds.ss && ['s', seconds]  ||
            seconds < thresholds.s   && ['ss', seconds] ||
            minutes <= 1             && ['m']           ||
            minutes < thresholds.m   && ['mm', minutes] ||
            hours   <= 1             && ['h']           ||
            hours   < thresholds.h   && ['hh', hours]   ||
            days    <= 1             && ['d']           ||
            days    < thresholds.d   && ['dd', days]    ||
            months  <= 1             && ['M']           ||
            months  < thresholds.M   && ['MM', months]  ||
            years   <= 1             && ['y']           || ['yy', years];

    a[2] = withoutSuffix;
    a[3] = +posNegDuration > 0;
    a[4] = locale;
    return substituteTimeAgo.apply(null, a);
}

// This function allows you to set the rounding function for relative time strings
function getSetRelativeTimeRounding (roundingFunction) {
    if (roundingFunction === undefined) {
        return round;
    }
    if (typeof(roundingFunction) === 'function') {
        round = roundingFunction;
        return true;
    }
    return false;
}

// This function allows you to set a threshold for relative time strings
function getSetRelativeTimeThreshold (threshold, limit) {
    if (thresholds[threshold] === undefined) {
        return false;
    }
    if (limit === undefined) {
        return thresholds[threshold];
    }
    thresholds[threshold] = limit;
    if (threshold === 's') {
        thresholds.ss = limit - 1;
    }
    return true;
}

function humanize (withSuffix) {
    if (!this.isValid()) {
        return this.localeData().invalidDate();
    }

    var locale = this.localeData();
    var output = relativeTime$1(this, !withSuffix, locale);

    if (withSuffix) {
        output = locale.pastFuture(+this, output);
    }

    return locale.postformat(output);
}

var abs$1 = Math.abs;

function sign(x) {
    return ((x > 0) - (x < 0)) || +x;
}

function toISOString$1() {
    // for ISO strings we do not use the normal bubbling rules:
    //  * milliseconds bubble up until they become hours
    //  * days do not bubble at all
    //  * months bubble up until they become years
    // This is because there is no context-free conversion between hours and days
    // (think of clock changes)
    // and also not between days and months (28-31 days per month)
    if (!this.isValid()) {
        return this.localeData().invalidDate();
    }

    var seconds = abs$1(this._milliseconds) / 1000;
    var days         = abs$1(this._days);
    var months       = abs$1(this._months);
    var minutes, hours, years;

    // 3600 seconds -> 60 minutes -> 1 hour
    minutes           = absFloor(seconds / 60);
    hours             = absFloor(minutes / 60);
    seconds %= 60;
    minutes %= 60;

    // 12 months -> 1 year
    years  = absFloor(months / 12);
    months %= 12;


    // inspired by https://github.com/dordille/moment-isoduration/blob/master/moment.isoduration.js
    var Y = years;
    var M = months;
    var D = days;
    var h = hours;
    var m = minutes;
    var s = seconds ? seconds.toFixed(3).replace(/\.?0+$/, '') : '';
    var total = this.asSeconds();

    if (!total) {
        // this is the same as C#'s (Noda) and python (isodate)...
        // but not other JS (goog.date)
        return 'P0D';
    }

    var totalSign = total < 0 ? '-' : '';
    var ymSign = sign(this._months) !== sign(total) ? '-' : '';
    var daysSign = sign(this._days) !== sign(total) ? '-' : '';
    var hmsSign = sign(this._milliseconds) !== sign(total) ? '-' : '';

    return totalSign + 'P' +
        (Y ? ymSign + Y + 'Y' : '') +
        (M ? ymSign + M + 'M' : '') +
        (D ? daysSign + D + 'D' : '') +
        ((h || m || s) ? 'T' : '') +
        (h ? hmsSign + h + 'H' : '') +
        (m ? hmsSign + m + 'M' : '') +
        (s ? hmsSign + s + 'S' : '');
}

var proto$2 = Duration.prototype;

proto$2.isValid        = isValid$1;
proto$2.abs            = abs;
proto$2.add            = add$1;
proto$2.subtract       = subtract$1;
proto$2.as             = as;
proto$2.asMilliseconds = asMilliseconds;
proto$2.asSeconds      = asSeconds;
proto$2.asMinutes      = asMinutes;
proto$2.asHours        = asHours;
proto$2.asDays         = asDays;
proto$2.asWeeks        = asWeeks;
proto$2.asMonths       = asMonths;
proto$2.asYears        = asYears;
proto$2.valueOf        = valueOf$1;
proto$2._bubble        = bubble;
proto$2.clone          = clone$1;
proto$2.get            = get$2;
proto$2.milliseconds   = milliseconds;
proto$2.seconds        = seconds;
proto$2.minutes        = minutes;
proto$2.hours          = hours;
proto$2.days           = days;
proto$2.weeks          = weeks;
proto$2.months         = months;
proto$2.years          = years;
proto$2.humanize       = humanize;
proto$2.toISOString    = toISOString$1;
proto$2.toString       = toISOString$1;
proto$2.toJSON         = toISOString$1;
proto$2.locale         = locale;
proto$2.localeData     = localeData;

proto$2.toIsoString = deprecate('toIsoString() is deprecated. Please use toISOString() instead (notice the capitals)', toISOString$1);
proto$2.lang = lang;

// Side effect imports

// FORMATTING

addFormatToken('X', 0, 0, 'unix');
addFormatToken('x', 0, 0, 'valueOf');

// PARSING

addRegexToken('x', matchSigned);
addRegexToken('X', matchTimestamp);
addParseToken('X', function (input, array, config) {
    config._d = new Date(parseFloat(input, 10) * 1000);
});
addParseToken('x', function (input, array, config) {
    config._d = new Date(toInt(input));
});

// Side effect imports


hooks.version = '2.21.0';

setHookCallback(createLocal);

hooks.fn                    = proto;
hooks.min                   = min;
hooks.max                   = max;
hooks.now                   = now;
hooks.utc                   = createUTC;
hooks.unix                  = createUnix;
hooks.months                = listMonths;
hooks.isDate                = isDate;
hooks.locale                = getSetGlobalLocale;
hooks.invalid               = createInvalid;
hooks.duration              = createDuration;
hooks.isMoment              = isMoment;
hooks.weekdays              = listWeekdays;
hooks.parseZone             = createInZone;
hooks.localeData            = getLocale;
hooks.isDuration            = isDuration;
hooks.monthsShort           = listMonthsShort;
hooks.weekdaysMin           = listWeekdaysMin;
hooks.defineLocale          = defineLocale;
hooks.updateLocale          = updateLocale;
hooks.locales               = listLocales;
hooks.weekdaysShort         = listWeekdaysShort;
hooks.normalizeUnits        = normalizeUnits;
hooks.relativeTimeRounding  = getSetRelativeTimeRounding;
hooks.relativeTimeThreshold = getSetRelativeTimeThreshold;
hooks.calendarFormat        = getCalendarFormat;
hooks.prototype             = proto;

// currently HTML5 input type only supports 24-hour formats
hooks.HTML5_FMT = {
    DATETIME_LOCAL: 'YYYY-MM-DDTHH:mm',             // <input type="datetime-local" />
    DATETIME_LOCAL_SECONDS: 'YYYY-MM-DDTHH:mm:ss',  // <input type="datetime-local" step="1" />
    DATETIME_LOCAL_MS: 'YYYY-MM-DDTHH:mm:ss.SSS',   // <input type="datetime-local" step="0.001" />
    DATE: 'YYYY-MM-DD',                             // <input type="date" />
    TIME: 'HH:mm',                                  // <input type="time" />
    TIME_SECONDS: 'HH:mm:ss',                       // <input type="time" step="1" />
    TIME_MS: 'HH:mm:ss.SSS',                        // <input type="time" step="0.001" />
    WEEK: 'YYYY-[W]WW',                             // <input type="week" />
    MONTH: 'YYYY-MM'                                // <input type="month" />
};

return hooks;

})));

},{}],17:[function(require,module,exports){
(function(window) {
    var re = {
        not_string: /[^s]/,
        number: /[diefg]/,
        json: /[j]/,
        not_json: /[^j]/,
        text: /^[^\x25]+/,
        modulo: /^\x25{2}/,
        placeholder: /^\x25(?:([1-9]\d*)\$|\(([^\)]+)\))?(\+)?(0|'[^$])?(-)?(\d+)?(?:\.(\d+))?([b-gijosuxX])/,
        key: /^([a-z_][a-z_\d]*)/i,
        key_access: /^\.([a-z_][a-z_\d]*)/i,
        index_access: /^\[(\d+)\]/,
        sign: /^[\+\-]/
    }

    function sprintf() {
        var key = arguments[0], cache = sprintf.cache
        if (!(cache[key] && cache.hasOwnProperty(key))) {
            cache[key] = sprintf.parse(key)
        }
        return sprintf.format.call(null, cache[key], arguments)
    }

    sprintf.format = function(parse_tree, argv) {
        var cursor = 1, tree_length = parse_tree.length, node_type = "", arg, output = [], i, k, match, pad, pad_character, pad_length, is_positive = true, sign = ""
        for (i = 0; i < tree_length; i++) {
            node_type = get_type(parse_tree[i])
            if (node_type === "string") {
                output[output.length] = parse_tree[i]
            }
            else if (node_type === "array") {
                match = parse_tree[i] // convenience purposes only
                if (match[2]) { // keyword argument
                    arg = argv[cursor]
                    for (k = 0; k < match[2].length; k++) {
                        if (!arg.hasOwnProperty(match[2][k])) {
                            throw new Error(sprintf("[sprintf] property '%s' does not exist", match[2][k]))
                        }
                        arg = arg[match[2][k]]
                    }
                }
                else if (match[1]) { // positional argument (explicit)
                    arg = argv[match[1]]
                }
                else { // positional argument (implicit)
                    arg = argv[cursor++]
                }

                if (get_type(arg) == "function") {
                    arg = arg()
                }

                if (re.not_string.test(match[8]) && re.not_json.test(match[8]) && (get_type(arg) != "number" && isNaN(arg))) {
                    throw new TypeError(sprintf("[sprintf] expecting number but found %s", get_type(arg)))
                }

                if (re.number.test(match[8])) {
                    is_positive = arg >= 0
                }

                switch (match[8]) {
                    case "b":
                        arg = arg.toString(2)
                    break
                    case "c":
                        arg = String.fromCharCode(arg)
                    break
                    case "d":
                    case "i":
                        arg = parseInt(arg, 10)
                    break
                    case "j":
                        arg = JSON.stringify(arg, null, match[6] ? parseInt(match[6]) : 0)
                    break
                    case "e":
                        arg = match[7] ? arg.toExponential(match[7]) : arg.toExponential()
                    break
                    case "f":
                        arg = match[7] ? parseFloat(arg).toFixed(match[7]) : parseFloat(arg)
                    break
                    case "g":
                        arg = match[7] ? parseFloat(arg).toPrecision(match[7]) : parseFloat(arg)
                    break
                    case "o":
                        arg = arg.toString(8)
                    break
                    case "s":
                        arg = ((arg = String(arg)) && match[7] ? arg.substring(0, match[7]) : arg)
                    break
                    case "u":
                        arg = arg >>> 0
                    break
                    case "x":
                        arg = arg.toString(16)
                    break
                    case "X":
                        arg = arg.toString(16).toUpperCase()
                    break
                }
                if (re.json.test(match[8])) {
                    output[output.length] = arg
                }
                else {
                    if (re.number.test(match[8]) && (!is_positive || match[3])) {
                        sign = is_positive ? "+" : "-"
                        arg = arg.toString().replace(re.sign, "")
                    }
                    else {
                        sign = ""
                    }
                    pad_character = match[4] ? match[4] === "0" ? "0" : match[4].charAt(1) : " "
                    pad_length = match[6] - (sign + arg).length
                    pad = match[6] ? (pad_length > 0 ? str_repeat(pad_character, pad_length) : "") : ""
                    output[output.length] = match[5] ? sign + arg + pad : (pad_character === "0" ? sign + pad + arg : pad + sign + arg)
                }
            }
        }
        return output.join("")
    }

    sprintf.cache = {}

    sprintf.parse = function(fmt) {
        var _fmt = fmt, match = [], parse_tree = [], arg_names = 0
        while (_fmt) {
            if ((match = re.text.exec(_fmt)) !== null) {
                parse_tree[parse_tree.length] = match[0]
            }
            else if ((match = re.modulo.exec(_fmt)) !== null) {
                parse_tree[parse_tree.length] = "%"
            }
            else if ((match = re.placeholder.exec(_fmt)) !== null) {
                if (match[2]) {
                    arg_names |= 1
                    var field_list = [], replacement_field = match[2], field_match = []
                    if ((field_match = re.key.exec(replacement_field)) !== null) {
                        field_list[field_list.length] = field_match[1]
                        while ((replacement_field = replacement_field.substring(field_match[0].length)) !== "") {
                            if ((field_match = re.key_access.exec(replacement_field)) !== null) {
                                field_list[field_list.length] = field_match[1]
                            }
                            else if ((field_match = re.index_access.exec(replacement_field)) !== null) {
                                field_list[field_list.length] = field_match[1]
                            }
                            else {
                                throw new SyntaxError("[sprintf] failed to parse named argument key")
                            }
                        }
                    }
                    else {
                        throw new SyntaxError("[sprintf] failed to parse named argument key")
                    }
                    match[2] = field_list
                }
                else {
                    arg_names |= 2
                }
                if (arg_names === 3) {
                    throw new Error("[sprintf] mixing positional and named placeholders is not (yet) supported")
                }
                parse_tree[parse_tree.length] = match
            }
            else {
                throw new SyntaxError("[sprintf] unexpected placeholder")
            }
            _fmt = _fmt.substring(match[0].length)
        }
        return parse_tree
    }

    var vsprintf = function(fmt, argv, _argv) {
        _argv = (argv || []).slice(0)
        _argv.splice(0, 0, fmt)
        return sprintf.apply(null, _argv)
    }

    /**
     * helpers
     */
    function get_type(variable) {
        return Object.prototype.toString.call(variable).slice(8, -1).toLowerCase()
    }

    function str_repeat(input, multiplier) {
        return Array(multiplier + 1).join(input)
    }

    /**
     * export to either browser or node.js
     */
    if (typeof exports !== "undefined") {
        exports.sprintf = sprintf
        exports.vsprintf = vsprintf
    }
    else {
        window.sprintf = sprintf
        window.vsprintf = vsprintf

        if (typeof define === "function" && define.amd) {
            define(function() {
                return {
                    sprintf: sprintf,
                    vsprintf: vsprintf
                }
            })
        }
    }
})(typeof window === "undefined" ? this : window);

},{}],18:[function(require,module,exports){
// -----
// The `timezoneJS.Date` object gives you full-blown timezone support, independent from the timezone set on the end-user's machine running the browser. It uses the Olson zoneinfo files for its timezone data.
//
// The constructor function and setter methods use proxy JavaScript Date objects behind the scenes, so you can use strings like '10/22/2006' with the constructor. You also get the same sensible wraparound behavior with numeric parameters (like setting a value of 14 for the month wraps around to the next March).
//
// The other significant difference from the built-in JavaScript Date is that `timezoneJS.Date` also has named properties that store the values of year, month, date, etc., so it can be directly serialized to JSON and used for data transfer.

/*
 * Copyright 2010 Matthew Eernisse (mde@fleegix.org)
 * and Open Source Applications Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Credits: Ideas included from incomplete JS implementation of Olson
 * parser, 'XMLDAte' by Philippe Goetz (philippe.goetz@wanadoo.fr)
 *
 * Contributions:
 * Jan Niehusmann
 * Ricky Romero
 * Preston Hunt (prestonhunt@gmail.com)
 * Dov. B Katz (dov.katz@morganstanley.com)
 * Peter Bergström (pbergstr@mac.com)
 * Long Ho
 */

 /*jshint laxcomma:true, laxbreak:true, expr:true*/
(function () {
  // Standard initialization stuff to make sure the library is
  // usable on both client and server (node) side.
  'use strict';
  var root = this;

  // Export the timezoneJS object for Node.js, with backwards-compatibility for the old `require()` API
  var timezoneJS = {};
  if (typeof define === 'function' && define.amd) { // AMD
    define(function() {
     return timezoneJS;
    });
  } else if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = timezoneJS;
    }
    exports.timezoneJS = timezoneJS;
  } else {
    root.timezoneJS = timezoneJS;
  }

  timezoneJS.VERSION = '0.4.13';

  // Grab the ajax library from global context.
  // This can be jQuery, Zepto or fleegix.
  // You can also specify your own transport mechanism by declaring
  // `timezoneJS.timezone.transport` to a `function`. More details will follow
  var ajax_lib = root.$ || root.jQuery || root.Zepto
    , fleegix = root.fleegix
    // Declare constant list of days and months. Unfortunately this doesn't leave room for i18n due to the Olson data being in English itself
    , DAYS = timezoneJS.Days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    , MONTHS = timezoneJS.Months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    , SHORT_MONTHS = {}
    , SHORT_DAYS = {}
    , EXACT_DATE_TIME = {};

  //`{ 'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5, 'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11 }`
  for (var i = 0; i < MONTHS.length; i++) {
    SHORT_MONTHS[MONTHS[i].substr(0, 3)] = i;
  }

  //`{ 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 }`
  for (i = 0; i < DAYS.length; i++) {
    SHORT_DAYS[DAYS[i].substr(0, 3)] = i;
  }


  //Handle array indexOf in IE
  //From https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/indexOf
  //Extending Array prototype causes IE to iterate thru extra element
  var _arrIndexOf = Array.prototype.indexOf || function (el) {
    if (this === null) {
      throw new TypeError();
    }
    var t = Object(this);
    var len = t.length >>> 0;
    if (len === 0) {
      return -1;
    }
    var n = 0;
    if (arguments.length > 1) {
      n = Number(arguments[1]);
      if (n != n) { // shortcut for verifying if it's NaN
        n = 0;
      } else if (n !== 0 && n !== Infinity && n !== -Infinity) {
        n = (n > 0 || -1) * Math.floor(Math.abs(n));
      }
    }
    if (n >= len) {
      return -1;
    }
    var k = n >= 0 ? n : Math.max(len - Math.abs(n), 0);
    for (; k < len; k++) {
      if (k in t && t[k] === el) {
        return k;
      }
    }
    return -1;
  };

  // Format a number to the length = digits. For ex:
  //
  // `_fixWidth(2, 2) = '02'`
  //
  // `_fixWidth(1998, 2) = '98'`  // year, shorten it to the 2 digit representation
  //
  // `_fixWidth(23, 1) = '23'`  // hour, even with 1 digit specified, do not trim
  //
  // This is used to pad numbers in converting date to string in ISO standard.
  var _fixWidth = function (number, digits) {
    if (typeof number !== 'number') { throw 'not a number: ' + number; }
    var trim = (number > 1000);   // only trim 'year', as the others don't make sense why anyone would want that
    var s = number.toString();
    var s_len = s.length;
    if (trim && s_len > digits) {
      return s.substr(s_len - digits, s_len);
    }
    s = [s];
    while (s_len < digits) {
      s.unshift('0');
      s_len++;
    }
    return s.join('');
  };

  // Abstraction layer for different transport layers, including fleegix/jQuery/Zepto/Node.js
  //
  // Object `opts` include
  //
  // - `url`: url to ajax query
  //
  // - `async`: true for asynchronous, false otherwise. If false, return value will be response from URL. This is true by default
  //
  // - `success`: success callback function
  //
  // - `error`: error callback function
  // Returns response from URL if async is false, otherwise the AJAX request object itself
  var _transport = function (opts) {
    if (!opts) return;
    if (!opts.url) throw new Error ('URL must be specified');
    if (!('async' in opts)) opts.async = true;

    // Server-side (node)
    // if node, require the file system module
    if (typeof window === 'undefined' && typeof require === 'function') {
      var nodefs = require('fs');
      if (opts.async) {
        // No point if there's no success handler
        if (typeof opts.success !== 'function') return;
        opts.error = opts.error || console.error;
        return nodefs.readFile(opts.url, 'utf8', function(err, data) {
          return err ? opts.error(err) : opts.success(data);
        });
      }
      return nodefs.readFileSync(opts.url, 'utf8');
    }

    // Client-side
    if ((!fleegix || typeof fleegix.xhr === 'undefined') && (!ajax_lib || typeof ajax_lib.ajax === 'undefined')) {
      throw new Error('Please use the Fleegix.js XHR module, jQuery ajax, Zepto ajax, or define your own transport mechanism for downloading zone files.');
    }
    if (!opts.async) {
      return fleegix && fleegix.xhr
      ? fleegix.xhr.doReq({ url: opts.url, async: false })
      : ajax_lib.ajax({ url : opts.url, async : false, dataType: 'text' }).responseText;
    }
    return fleegix && fleegix.xhr
    ? fleegix.xhr.send({
      url : opts.url,
      method : 'get',
      handleSuccess : opts.success,
      handleErr : opts.error
    })
    : ajax_lib.ajax({
      url : opts.url,
      dataType: 'text',
      method : 'GET',
      error : opts.error,
      success : opts.success
    });
  };

  // Constructor, which is similar to that of the native Date object itself
  timezoneJS.Date = function () {
    if(this === timezoneJS) {
      throw 'timezoneJS.Date object must be constructed with \'new\'';
    }
    var args = Array.prototype.slice.apply(arguments)
    , dt = null
    , tz = null
    , arr = []
    , valid = false
    ;


    //We support several different constructors, including all the ones from `Date` object
    // with a timezone string at the end.
    //
    //- `[tz]`: Returns object with time in `tz` specified.
    //
    // - `utcMillis`, `[tz]`: Return object with UTC time = `utcMillis`, in `tz`.
    //
    // - `Date`, `[tz]`: Returns object with UTC time = `Date.getTime()`, in `tz`.
    //
    // - `year, month, [date,] [hours,] [minutes,] [seconds,] [millis,] [tz]: Same as `Date` object
    // with tz.
    //
    // - `Array`: Can be any combo of the above.
    //
    //If 1st argument is an array, we can use it as a list of arguments itself
    if (Object.prototype.toString.call(args[0]) === '[object Array]') {
      args = args[0];
    }
    // If the last string argument doesn't parse as a Date, treat it as tz
    if (typeof args[args.length - 1] === 'string') {
      valid = Date.parse(args[args.length - 1].replace(/GMT[\+\-]\d+/, ''));
      if (isNaN(valid) || valid === null) {  // Checking against null is required for compatability with Datejs
        tz = args.pop();
      }
    }
    var is_dt_local = false;
    switch (args.length) {
      case 0:
        dt = new Date();
        break;
      case 1:
        dt = new Date(args[0]);
        // Date strings are local if they do not contain 'Z', 'T' or timezone offsets like '+0200'
        //  - more info below
        if (typeof args[0] == 'string' && args[0].search(/[+-][0-9]{4}/) == -1
                && args[0].search(/Z/) == -1 && args[0].search(/T/) == -1) {
            is_dt_local = true;
        }
        break;
      case 2:
        dt = new Date(args[0], args[1]);
        is_dt_local = true;
        break;
      default:
        for (var i = 0; i < 7; i++) {
          arr[i] = args[i] || 0;
        }
        dt = new Date(arr[0], arr[1], arr[2], arr[3], arr[4], arr[5], arr[6]);
        is_dt_local = true;
        break;
    }

    this._useCache = false;
    this._tzInfo = {};
    this._day = 0;
    this.year = 0;
    this.month = 0;
    this.date = 0;
    this.hours = 0;
    this.minutes = 0;
    this.seconds = 0;
    this.milliseconds = 0;
    this.timezone = tz || null;
    // Tricky part:
    // The date is either given as unambiguous UTC date or otherwise the date is assumed
    // to be a date in timezone `tz` or a locale date if `tz` is not provided. Thus, to
    // determine how to use `dt` we distinguish between the following cases:
    //  - UTC   (is_dt_local = false)
    //    `timezoneJS.Date(millis, [tz])`
    //    `timezoneJS.Date(Date, [tz])`
    //    `timezoneJS.Date(dt_str_tz, [tz])`
    //  - local/timezone `tz`   (is_dt_local = true)
    //    `timezoneJS.Date(year, mon, day, [hour], [min], [second], [tz])`
    //    `timezoneJS.Date(dt_str, [tz])`
    //
    // `dt_str_tz` is a date string containing timezone information, i.e. containing 'Z', 'T' or
    // /[+-][0-9]{4}/ (e.g. '+0200'), while `dt_str` is a string which does not contain
    // timezone information. See: http://dygraphs.com/date-formats.html
    if (is_dt_local) {
       this.setFromDateObjProxy(dt);
    } else {
       this.setFromTimeProxy(dt.getTime(), tz);
    }
  };

  // Implements most of the native Date object
  timezoneJS.Date.prototype = {
    getDate: function () { return this.date; },
    getDay: function () { return this._day; },
    getFullYear: function () { return this.year; },
    getMonth: function () { return this.month; },
    getYear: function () { return this.year - 1900; },
    getHours: function () { return this.hours; },
    getMilliseconds: function () { return this.milliseconds; },
    getMinutes: function () { return this.minutes; },
    getSeconds: function () { return this.seconds; },
    getUTCDate: function () { return this.getUTCDateProxy().getUTCDate(); },
    getUTCDay: function () { return this.getUTCDateProxy().getUTCDay(); },
    getUTCFullYear: function () { return this.getUTCDateProxy().getUTCFullYear(); },
    getUTCHours: function () { return this.getUTCDateProxy().getUTCHours(); },
    getUTCMilliseconds: function () { return this.getUTCDateProxy().getUTCMilliseconds(); },
    getUTCMinutes: function () { return this.getUTCDateProxy().getUTCMinutes(); },
    getUTCMonth: function () { return this.getUTCDateProxy().getUTCMonth(); },
    getUTCSeconds: function () { return this.getUTCDateProxy().getUTCSeconds(); },
    // Time adjusted to user-specified timezone
    getTime: function () {
      return this._timeProxy + (this.getTimezoneOffset() * 60 * 1000);
    },
    getTimezone: function () { return this.timezone; },
    getTimezoneOffset: function () { return this.getTimezoneInfo().tzOffset; },
    getTimezoneAbbreviation: function () { return this.getTimezoneInfo().tzAbbr; },
    getTimezoneInfo: function () {
      if (this._useCache) return this._tzInfo;
      var res;
      // If timezone is specified, get the correct timezone info based on the Date given
      if (this.timezone) {
        res = this.timezone === 'Etc/UTC' || this.timezone === 'Etc/GMT'
          ? { tzOffset: 0, tzAbbr: 'UTC' }
          : timezoneJS.timezone.getTzInfo(this._timeProxy, this.timezone);
      }
      // If no timezone was specified, use the local browser offset
      else {
        res = { tzOffset: this.getLocalOffset(), tzAbbr: null };
      }
      this._tzInfo = res;
      this._useCache = true;
      return res;
    },
    getUTCDateProxy: function () {
      var dt = new Date(this._timeProxy);
      dt.setUTCMinutes(dt.getUTCMinutes() + this.getTimezoneOffset());
      return dt;
    },
    setDate: function (date) {
      this.setAttribute('date', date);
      return this.getTime();
    },
    setFullYear: function (year, month, date) {
      if (date !== undefined) { this.setAttribute('date', 1); }
      this.setAttribute('year', year);
      if (month !== undefined) { this.setAttribute('month', month); }
      if (date !== undefined) { this.setAttribute('date', date); }
      return this.getTime();
    },
    setMonth: function (month, date) {
      this.setAttribute('month', month);
      if (date !== undefined) { this.setAttribute('date', date); }
      return this.getTime();
    },
    setYear: function (year) {
      year = Number(year);
      if (0 <= year && year <= 99) { year += 1900; }
      this.setUTCAttribute('year', year);
      return this.getTime();
    },
    setHours: function (hours, minutes, seconds, milliseconds) {
      this.setAttribute('hours', hours);
      if (minutes !== undefined) { this.setAttribute('minutes', minutes); }
      if (seconds !== undefined) { this.setAttribute('seconds', seconds); }
      if (milliseconds !== undefined) { this.setAttribute('milliseconds', milliseconds); }
      return this.getTime();
    },
    setMinutes: function (minutes, seconds, milliseconds) {
      this.setAttribute('minutes', minutes);
      if (seconds !== undefined) { this.setAttribute('seconds', seconds); }
      if (milliseconds !== undefined) { this.setAttribute('milliseconds', milliseconds); }
      return this.getTime();
    },
    setSeconds: function (seconds, milliseconds) {
      this.setAttribute('seconds', seconds);
      if (milliseconds !== undefined) { this.setAttribute('milliseconds', milliseconds); }
      return this.getTime();
    },
    setMilliseconds: function (milliseconds) {
      this.setAttribute('milliseconds', milliseconds);
      return this.getTime();
    },
    setTime: function (n) {
      if (isNaN(n)) { throw new Error('Units must be a number.'); }
      this.setFromTimeProxy(n, this.timezone);
      return this.getTime();
    },
    setUTCFullYear: function (year, month, date) {
      if (date !== undefined) { this.setUTCAttribute('date', 1); }
      this.setUTCAttribute('year', year);
      if (month !== undefined) { this.setUTCAttribute('month', month); }
      if (date !== undefined) { this.setUTCAttribute('date', date); }
      return this.getTime();
    },
    setUTCMonth: function (month, date) {
      this.setUTCAttribute('month', month);
      if (date !== undefined) { this.setUTCAttribute('date', date); }
      return this.getTime();
    },
    setUTCDate: function (date) {
      this.setUTCAttribute('date', date);
      return this.getTime();
    },
    setUTCHours: function (hours, minutes, seconds, milliseconds) {
      this.setUTCAttribute('hours', hours);
      if (minutes !== undefined) { this.setUTCAttribute('minutes', minutes); }
      if (seconds !== undefined) { this.setUTCAttribute('seconds', seconds); }
      if (milliseconds !== undefined) { this.setUTCAttribute('milliseconds', milliseconds); }
      return this.getTime();
    },
    setUTCMinutes: function (minutes, seconds, milliseconds) {
      this.setUTCAttribute('minutes', minutes);
      if (seconds !== undefined) { this.setUTCAttribute('seconds', seconds); }
      if (milliseconds !== undefined) { this.setUTCAttribute('milliseconds', milliseconds); }
      return this.getTime();
    },
    setUTCSeconds: function (seconds, milliseconds) {
      this.setUTCAttribute('seconds', seconds);
      if (milliseconds !== undefined) { this.setUTCAttribute('milliseconds', milliseconds); }
      return this.getTime();
    },
    setUTCMilliseconds: function (milliseconds) {
      this.setUTCAttribute('milliseconds', milliseconds);
      return this.getTime();
    },
    setFromDateObjProxy: function (dt) {
      this.year = dt.getFullYear();
      this.month = dt.getMonth();
      this.date = dt.getDate();
      this.hours = dt.getHours();
      this.minutes = dt.getMinutes();
      this.seconds = dt.getSeconds();
      this.milliseconds = dt.getMilliseconds();
      this._day = dt.getDay();
      this._dateProxy = dt;
      this._timeProxy = Date.UTC(this.year, this.month, this.date, this.hours, this.minutes, this.seconds, this.milliseconds);
      this._useCache = false;
    },
    setFromTimeProxy: function (utcMillis, tz) {
      var dt = new Date(utcMillis);
      var tzOffset = tz ? timezoneJS.timezone.getTzInfo(utcMillis, tz, true).tzOffset : dt.getTimezoneOffset();
      dt.setTime(utcMillis + (dt.getTimezoneOffset() - tzOffset) * 60000);
      this.setFromDateObjProxy(dt);
    },
    setAttribute: function (unit, n) {
      if (isNaN(n)) { throw new Error('Units must be a number.'); }
      var dt = this._dateProxy;
      var meth = unit === 'year' ? 'FullYear' : unit.substr(0, 1).toUpperCase() + unit.substr(1);
      dt['set' + meth](n);
      this.setFromDateObjProxy(dt);
    },
    setUTCAttribute: function (unit, n) {
      if (isNaN(n)) { throw new Error('Units must be a number.'); }
      var meth = unit === 'year' ? 'FullYear' : unit.substr(0, 1).toUpperCase() + unit.substr(1);
      var dt = this.getUTCDateProxy();
      dt['setUTC' + meth](n);
      dt.setUTCMinutes(dt.getUTCMinutes() - this.getTimezoneOffset());
      this.setFromTimeProxy(dt.getTime() + this.getTimezoneOffset() * 60000, this.timezone);
    },
    setTimezone: function (tz) {
      var previousOffset = this.getTimezoneInfo().tzOffset;
      this.timezone = tz;
      this._useCache = false;
      // Set UTC minutes offsets by the delta of the two timezones
      this.setUTCMinutes(this.getUTCMinutes() - this.getTimezoneInfo().tzOffset + previousOffset);
    },
    removeTimezone: function () {
      this.timezone = null;
      this._useCache = false;
    },
    valueOf: function () { return this.getTime(); },
    clone: function () {
      return this.timezone ? new timezoneJS.Date(this.getTime(), this.timezone) : new timezoneJS.Date(this.getTime());
    },
    toGMTString: function () { return this.toString('EEE, dd MMM yyyy HH:mm:ss Z', 'Etc/GMT'); },
    toLocaleString: function () {},
    toLocaleDateString: function () {},
    toLocaleTimeString: function () {},
    toSource: function () {},
    toISOString: function () { return this.toString('yyyy-MM-ddTHH:mm:ss.SSS', 'Etc/UTC') + 'Z'; },
    toJSON: function () { return this.toISOString(); },
    toDateString: function () { return this.toString('EEE MMM dd yyyy'); },
    toTimeString: function () { return this.toString('H:mm k'); },
    // Allows different format following ISO8601 format:
    toString: function (format, tz) {
      // Default format is the same as toISOString
      if (!format) format = 'yyyy-MM-dd HH:mm:ss';
      var result = format;
      var tzInfo = tz ? timezoneJS.timezone.getTzInfo(this.getTime(), tz) : this.getTimezoneInfo();
      var _this = this;
      // If timezone is specified, get a clone of the current Date object and modify it
      if (tz) {
        _this = this.clone();
        _this.setTimezone(tz);
      }
      var hours = _this.getHours();
      return result
      // fix the same characters in Month names
      .replace(/a+/g, function () { return 'k'; })
      // `y`: year
      .replace(/y+/g, function (token) { return _fixWidth(_this.getFullYear(), token.length); })
      // `d`: date
      .replace(/d+/g, function (token) { return _fixWidth(_this.getDate(), token.length); })
      // `m`: minute
      .replace(/m+/g, function (token) { return _fixWidth(_this.getMinutes(), token.length); })
      // `s`: second
      .replace(/s+/g, function (token) { return _fixWidth(_this.getSeconds(), token.length); })
      // `S`: millisecond
      .replace(/S+/g, function (token) { return _fixWidth(_this.getMilliseconds(), token.length); })
      // 'h': 12 hour format
      .replace(/h+/g, function (token) { return _fixWidth( ((hours%12) === 0) ? 12 : (hours % 12), token.length); })
      // `M`: month. Note: `MM` will be the numeric representation (e.g February is 02) but `MMM` will be text representation (e.g February is Feb)
      .replace(/M+/g, function (token) {
        var _month = _this.getMonth(),
        _len = token.length;
        if (_len > 3) {
          return timezoneJS.Months[_month];
        } else if (_len > 2) {
          return timezoneJS.Months[_month].substring(0, _len);
        }
        return _fixWidth(_month + 1, _len);
      })
      // `k`: AM/PM
      .replace(/k+/g, function () {
        if (hours >= 12) {
          if (hours > 12) {
            hours -= 12;
          }
          return 'PM';
        }
        return 'AM';
      })
      // `H`: hour
      .replace(/H+/g, function (token) { return _fixWidth(hours, token.length); })
      // `E`: day
      .replace(/E+/g, function (token) { return DAYS[_this.getDay()].substring(0, token.length); })
      // `Z`: timezone abbreviation
      .replace(/Z+/gi, function () { return tzInfo.tzAbbr; });
    },
    toUTCString: function () { return this.toGMTString(); },
    civilToJulianDayNumber: function (y, m, d) {
      var a;
      // Adjust for zero-based JS-style array
      m++;
      if (m > 12) {
        a = parseInt(m/12, 10);
        m = m % 12;
        y += a;
      }
      if (m <= 2) {
        y -= 1;
        m += 12;
      }
      a = Math.floor(y / 100);
      var b = 2 - a + Math.floor(a / 4)
        , jDt = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524;
      return jDt;
    },
    getLocalOffset: function () {
      return this._dateProxy.getTimezoneOffset();
    }
  };


  timezoneJS.timezone = new function () {
    var _this = this
      , regionMap = {'Etc':'etcetera','EST':'northamerica','MST':'northamerica','HST':'northamerica','EST5EDT':'northamerica','CST6CDT':'northamerica','MST7MDT':'northamerica','PST8PDT':'northamerica','America':['northamerica','southamerica'],'Pacific':'australasia','Atlantic':'europe','Africa':'africa','Indian':'africa','Antarctica':'antarctica','Asia':'asia','Australia':'australasia','Europe':'europe','WET':'europe','CET':'europe','MET':'europe','EET':'europe'}
      , regionExceptions = {'Pacific/Honolulu':'northamerica','Atlantic/Bermuda':'northamerica','Atlantic/Cape_Verde':'africa','Atlantic/St_Helena':'africa','Indian/Kerguelen':'antarctica','Indian/Chagos':'asia','Indian/Maldives':'asia','Indian/Christmas':'australasia','Indian/Cocos':'australasia','America/Danmarkshavn':'europe','America/Scoresbysund':'europe','America/Godthab':'europe','America/Thule':'europe','Asia/Istanbul':'europe','Asia/Yekaterinburg':'europe','Asia/Omsk':'europe','Asia/Novosibirsk':'europe','Asia/Krasnoyarsk':'europe','Asia/Irkutsk':'europe','Asia/Yakutsk':'europe','Asia/Vladivostok':'europe','Asia/Sakhalin':'europe','Asia/Magadan':'europe','Asia/Kamchatka':'europe','Asia/Anadyr':'europe','Africa/Ceuta':'europe','GMT':'etcetera','Europe/Nicosia':'asia'};
    function invalidTZError(t) { throw new Error('Timezone \'' + t + '\' is either incorrect, or not loaded in the timezone registry.'); }
    function builtInLoadZoneFile(fileName, opts) {
      var url = _this.zoneFileBasePath + '/' + fileName;
      return !opts || !opts.async
      ? _this.parseZones(_this.transport({ url : url, async : false }))
      : _this.transport({
        async: true,
        url : url,
        success : function (str) {
          return _this.parseZones(str) && typeof opts.callback === 'function' && opts.callback();
        },
        error : function () {
          throw new Error('Error retrieving \'' + url + '\' zoneinfo files');
        }
      });
    }
    function getRegionForTimezone(tz) {
      var exc = regionExceptions[tz]
        , reg
        , ret;
      if (exc) return exc;
      reg = tz.split('/')[0];
      ret = regionMap[reg];
      // If there's nothing listed in the main regions for this TZ, check the 'backward' links
      if (ret) return ret;
      var link = _this.zones[tz];
      if (typeof link === 'string') {
        return getRegionForTimezone(link);
      }
      // Backward-compat file hasn't loaded yet, try looking in there
      if (!_this.loadedZones.backward) {
        // This is for obvious legacy zones (e.g., Iceland) that don't even have a prefix like 'America/' that look like normal zones
        _this.loadZoneFile('backward');
        return getRegionForTimezone(tz);
      }
      invalidTZError(tz);
    }
    //str has format hh:mm, can be negative
    function parseTimeString(str) {
      var pat = /(\d+)(?::0*(\d*))?(?::0*(\d*))?([wsugz])?$/;
      var hms = str.match(pat);
      hms[1] = parseInt(hms[1], 10);
      hms[2] = hms[2] ? parseInt(hms[2], 10) : 0;
      hms[3] = hms[3] ? parseInt(hms[3], 10) : 0;
      return hms.slice(1, 5);
    }
    //z is something like `[ '-3:44:40', '-', 'LMT', '1911', 'May', '15', '' ]` or `[ '-5:00', '-', 'EST', '1974', 'Apr', '28', '2:00' ]`
    function processZone(z) {
      if (!z[3]) { return; }
      var yea = parseInt(z[3], 10)
        , mon = 11
        , dat = 31;
      //If month is there
      if (z[4]) {
        mon = SHORT_MONTHS[z[4].substr(0, 3)];
        dat = parseInt(z[5], 10) || 1;
      }
      var t = z[6] ? parseTimeString(z[6]) : [0, 0, 0];
      return [yea, mon, dat, t[0], t[1], t[2]];
    }
    function getZone(dt, tz) {
      var utcMillis = typeof dt === 'number' ? dt : new Date(dt).getTime();
      var t = tz;
      var zoneList = _this.zones[t];
      // Follow links to get to an actual zone
      while (typeof zoneList === 'string') {
        t = zoneList;
        zoneList = _this.zones[t];
      }
      if (!zoneList) {
        // Backward-compat file hasn't loaded yet, try looking in there
        if (!_this.loadedZones.backward) {
          //This is for backward entries like 'America/Fort_Wayne' that
          // getRegionForTimezone *thinks* it has a region file and zone
          // for (e.g., America => 'northamerica'), but in reality it's a
          // legacy zone we need the backward file for.
          _this.loadZoneFile('backward');
          return getZone(dt, tz);
        }
        invalidTZError(t);
      }
      if (zoneList.length === 0) {
        throw new Error('No Zone found for \'' + tz + '\' on ' + dt);
      }
      //Do backwards lookup since most use cases deal with newer dates.
      for (var i = zoneList.length - 1; i >= 0; i--) {
        var z = zoneList[i];
        if (z[3] && utcMillis > z[3]) break;
      }
      return zoneList[i+1];
    }
    function getBasicOffset(time) {
      var off = parseTimeString(time)
        , adj = time.charAt(0) === '-' ? -1 : 1;
      off = adj * (((off[0] * 60 + off[1]) * 60 + off[2]) * 1000);
      return off/60/1000;
    }
    function getAdjustedOffset(off, min) {
      return -Math.ceil(min - off);
    }

    //if isUTC is true, date is given in UTC, otherwise it's given
    // in local time (ie. date.getUTC*() returns local time components)
    function getRule(dt, zone, isUTC) {
      var date = typeof dt === 'number' ? new Date(dt) : dt;
      var ruleset = zone[1];
      var basicOffset = zone[0];

      // If the zone has a DST rule like '1:00', create a rule and return it
      // instead of looking it up in the parsed rules
      var staticDstMatch = ruleset.match(/^([0-9]):([0-9][0-9])$/);
      if (staticDstMatch) {
        return [-1000000, 'max', '-', 'Jan', 1, [0, 0, 0], parseInt(staticDstMatch[1],10) * 60 + parseInt(staticDstMatch[2], 10), '-'];
      }

      //Convert a date to UTC. Depending on the 'type' parameter, the date
      // parameter may be:
      //
      // - `u`, `g`, `z`: already UTC (no adjustment).
      //
      // - `s`: standard time (adjust for time zone offset but not for DST)
      //
      // - `w`: wall clock time (adjust for both time zone and DST offset).
      //
      // DST adjustment is done using the rule given as third argument.
      var convertDateToUTC = function (date, type, rule) {
        var offset = 0;

        if (type === 'u' || type === 'g' || type === 'z') { // UTC
          offset = 0;
        } else if (type === 's') { // Standard Time
          offset = basicOffset;
        } else if (type === 'w' || !type) { // Wall Clock Time
          offset = getAdjustedOffset(basicOffset, rule[6]);
        } else {
          throw new Error('unknown type ' + type);
        }
        offset *= 60 * 1000; // to millis

        return new Date(date.getTime() + offset);
      };

      //Step 1:  Find applicable rules for this year.
      //
      //Step 2:  Sort the rules by effective date.
      //
      //Step 3:  Check requested date to see if a rule has yet taken effect this year.  If not,
      //
      //Step 4:  Get the rules for the previous year.  If there isn't an applicable rule for last year, then
      // there probably is no current time offset since they seem to explicitly turn off the offset
      // when someone stops observing DST.
      //
      // FIXME if this is not the case and we'll walk all the way back (ugh).
      //
      //Step 5:  Sort the rules by effective date.
      //Step 6:  Apply the most recent rule before the current time.
      var convertRuleToExactDateAndTime = function (yearAndRule, prevRule) {
        var year = yearAndRule[0]
          , rule = yearAndRule[1];
          // Assume that the rule applies to the year of the given date.

        var hms = rule[5];
        var effectiveDate;

        if (!EXACT_DATE_TIME[year])
          EXACT_DATE_TIME[year] = {};

        // Result for given parameters is already stored
        if (EXACT_DATE_TIME[year][rule])
          effectiveDate = EXACT_DATE_TIME[year][rule];
        else {
          //If we have a specific date, use that!
          if (!isNaN(rule[4])) {
            effectiveDate = new Date(Date.UTC(year, SHORT_MONTHS[rule[3]], rule[4], hms[0], hms[1], hms[2], 0));
          }
          //Let's hunt for the date.
          else {
            var targetDay
              , operator;
            //Example: `lastThu`
            if (rule[4].substr(0, 4) === 'last') {
              // Start at the last day of the month and work backward.
              effectiveDate = new Date(Date.UTC(year, SHORT_MONTHS[rule[3]] + 1, 1, hms[0] - 24, hms[1], hms[2], 0));
              targetDay = SHORT_DAYS[rule[4].substr(4, 3)];
              operator = '<=';
            }
            //Example: `Sun>=15`
            else {
              //Start at the specified date.
              effectiveDate = new Date(Date.UTC(year, SHORT_MONTHS[rule[3]], rule[4].substr(5), hms[0], hms[1], hms[2], 0));
              targetDay = SHORT_DAYS[rule[4].substr(0, 3)];
              operator = rule[4].substr(3, 2);
            }
            var ourDay = effectiveDate.getUTCDay();
            //Go forwards.
            if (operator === '>=') {
              effectiveDate.setUTCDate(effectiveDate.getUTCDate() + (targetDay - ourDay + ((targetDay < ourDay) ? 7 : 0)));
            }
            //Go backwards.  Looking for the last of a certain day, or operator is '<=' (less likely).
            else {
              effectiveDate.setUTCDate(effectiveDate.getUTCDate() + (targetDay - ourDay - ((targetDay > ourDay) ? 7 : 0)));
            }
          }
          EXACT_DATE_TIME[year][rule] = effectiveDate;
        }


        //If previous rule is given, correct for the fact that the starting time of the current
        // rule may be specified in local time.
        if (prevRule) {
          effectiveDate = convertDateToUTC(effectiveDate, hms[3], prevRule);
        }
        return effectiveDate;
      };

      var findApplicableRules = function (year, ruleset) {
        var applicableRules = [];
        for (var i = 0; ruleset && i < ruleset.length; i++) {
          //Exclude future rules.
          if (ruleset[i][0] <= year &&
              (
                // Date is in a set range.
                ruleset[i][1] >= year ||
                // Date is in an 'only' year.
                  (ruleset[i][0] === year && ruleset[i][1] === 'only') ||
                //We're in a range from the start year to infinity.
                    ruleset[i][1] === 'max'
          )
             ) {
               //It's completely okay to have any number of matches here.
               // Normally we should only see two, but that doesn't preclude other numbers of matches.
               // These matches are applicable to this year.
               applicableRules.push([year, ruleset[i]]);
             }
        }
        return applicableRules;
      };

      var compareDates = function (a, b, prev) {
        var year, rule;
        if (!(a instanceof Date)) {
          year = a[0];
          rule = a[1];
          a = (!prev && EXACT_DATE_TIME[year] && EXACT_DATE_TIME[year][rule])
            ? EXACT_DATE_TIME[year][rule]
            : convertRuleToExactDateAndTime(a, prev);
        } else if (prev) {
          a = convertDateToUTC(a, isUTC ? 'u' : 'w', prev);
        }
        if (!(b instanceof Date)) {
          year = b[0];
          rule = b[1];
          b = (!prev && EXACT_DATE_TIME[year] && EXACT_DATE_TIME[year][rule]) ? EXACT_DATE_TIME[year][rule]
            : convertRuleToExactDateAndTime(b, prev);
        } else if (prev) {
          b = convertDateToUTC(b, isUTC ? 'u' : 'w', prev);
        }
        a = Number(a);
        b = Number(b);
        return a - b;
      };

      var year = date.getUTCFullYear();
      var applicableRules;

      applicableRules = findApplicableRules(year, _this.rules[ruleset]);
      applicableRules.push(date);
      //While sorting, the time zone in which the rule starting time is specified
      // is ignored. This is ok as long as the timespan between two DST changes is
      // larger than the DST offset, which is probably always true.
      // As the given date may indeed be close to a DST change, it may get sorted
      // to a wrong position (off by one), which is corrected below.
      applicableRules.sort(compareDates);

      //If there are not enough past DST rules...
      if (_arrIndexOf.call(applicableRules, date) < 2) {
        applicableRules = applicableRules.concat(findApplicableRules(year-1, _this.rules[ruleset]));
        applicableRules.sort(compareDates);
      }
      var pinpoint = _arrIndexOf.call(applicableRules, date);
      if (pinpoint > 1 && compareDates(date, applicableRules[pinpoint-1], applicableRules[pinpoint-2][1]) < 0) {
        //The previous rule does not really apply, take the one before that.
        return applicableRules[pinpoint - 2][1];
      } else if (pinpoint > 0 && pinpoint < applicableRules.length - 1 && compareDates(date, applicableRules[pinpoint+1], applicableRules[pinpoint-1][1]) > 0) {

        //The next rule does already apply, take that one.
        return applicableRules[pinpoint + 1][1];
      } else if (pinpoint === 0) {
        //No applicable rule found in this and in previous year.
        return null;
      }
      return applicableRules[pinpoint - 1][1];
    }
    function getAbbreviation(zone, rule) {
      var base = zone[2];
      if (base.indexOf('%s') > -1) {
        var repl;
        if (rule) {
          repl = rule[7] === '-' ? '' : rule[7];
        }
        //FIXME: Right now just falling back to Standard --
        // apparently ought to use the last valid rule,
        // although in practice that always ought to be Standard
        else {
          repl = 'S';
        }
        return base.replace('%s', repl);
      } else if (base.indexOf('/') > -1) {
        //Chose one of two alternative strings.
        return base.split('/', 2)[rule ? (rule[6] ? 1 : 0) : 0];
      }
      return base;
    }

    this.zoneFileBasePath = null;
    this.zoneFiles = ['africa', 'antarctica', 'asia', 'australasia', 'backward', 'etcetera', 'europe', 'northamerica', 'pacificnew', 'southamerica'];
    this.loadingSchemes = {
      PRELOAD_ALL: 'preloadAll',
      LAZY_LOAD: 'lazyLoad',
      MANUAL_LOAD: 'manualLoad'
    };
    this.getRegionForTimezone = getRegionForTimezone;
    this.loadingScheme = this.loadingSchemes.LAZY_LOAD;
    this.loadedZones = {};
    this.zones = {};
    this.rules = {};

    this.init = function (o) {
      var opts = { async: true }
        , def = this.loadingScheme === this.loadingSchemes.PRELOAD_ALL
          ? this.zoneFiles
          : (this.defaultZoneFile || 'northamerica');
      //Override default with any passed-in opts
      for (var p in o) {
        opts[p] = o[p];
      }
      return this.loadZoneFiles(def, opts);
    };

    //Get a single zone file, or all files in an array
    this.loadZoneFiles = function(fileNames, opts) {
      var callbackFn
        , done = 0;
      if (typeof fileNames === 'string') {
        return this.loadZoneFile(fileNames, opts);
      }
      //Wraps callback function in another one that makes
      // sure all files have been loaded.
      opts = opts || {};
      callbackFn = opts.callback;
      opts.callback = function () {
        done++;
        (done === fileNames.length) && typeof callbackFn === 'function' && callbackFn();
      };
      for (var i = 0; i < fileNames.length; i++) {
        this.loadZoneFile(fileNames[i], opts);
      }
    };
    //Get the zone files via XHR -- if the sync flag
    // is set to true, it's being called by the lazy-loading
    // mechanism, so the result needs to be returned inline.
    this.loadZoneFile = function (fileName, opts) {
      if (typeof this.zoneFileBasePath === 'undefined') {
        throw new Error('Please define a base path to your zone file directory -- timezoneJS.timezone.zoneFileBasePath.');
      }
      //Ignore already loaded zones.
      if (this.loadedZones[fileName]) {
        return;
      }
      this.loadedZones[fileName] = true;
      return builtInLoadZoneFile(fileName, opts);
    };
    this.loadZoneJSONData = function (url, sync) {
      var processData = function (data) {
        data = eval('('+ data +')');
        for (var z in data.zones) {
          _this.zones[z] = data.zones[z];
        }
        for (var r in data.rules) {
          _this.rules[r] = data.rules[r];
        }
      };
      return sync
      ? processData(_this.transport({ url : url, async : false }))
      : _this.transport({ url : url, success : processData });
    };
    this.loadZoneDataFromObject = function (data) {
      if (!data) { return; }
      for (var z in data.zones) {
        _this.zones[z] = data.zones[z];
      }
      for (var r in data.rules) {
        _this.rules[r] = data.rules[r];
      }
    };
    this.getAllZones = function () {
      var arr = [];
      for (var z in this.zones) { arr.push(z); }
      return arr.sort();
    };
    this.parseZones = function (str) {

      if (!str) {
        return false;
      }

      var lines = str.split('\n')
        , arr = []
        , chunk = ''
        , l
        , zone = null
        , rule = null;
      for (var i = 0; i < lines.length; i++) {
        l = lines[i];
        if (l.match(/^\s/)) {
          l = 'Zone ' + zone + l;
        }
        l = l.split('#')[0];
        if (l.length > 3) {
          arr = l.split(/\s+/);
          chunk = arr.shift();
          //Ignore Leap.
          switch (chunk) {
            case 'Zone':
              zone = arr.shift();
              if (!_this.zones[zone]) {
                _this.zones[zone] = [];
              }
              if (arr.length < 3) break;
              //Process zone right here and replace 3rd element with the processed array.
              arr.splice(3, arr.length, processZone(arr));
              if (arr[3]) arr[3] = Date.UTC.apply(null, arr[3]);
              arr[0] = -getBasicOffset(arr[0]);
              _this.zones[zone].push(arr);
              break;
            case 'Rule':
              rule = arr.shift();
              if (!_this.rules[rule]) {
                _this.rules[rule] = [];
              }
              //Parse int FROM year and TO year
              arr[0] = parseInt(arr[0], 10);
              arr[1] = parseInt(arr[1], 10) || arr[1];
              //Parse time string AT
              arr[5] = parseTimeString(arr[5]);
              //Parse offset SAVE
              arr[6] = getBasicOffset(arr[6]);
              _this.rules[rule].push(arr);
              break;
            case 'Link':
              //No zones for these should already exist.
              if (_this.zones[arr[1]]) {
                throw new Error('Error with Link ' + arr[1] + '. Cannot create link of a preexisted zone.');
              }
              //Create the link.
              //Links are saved as strings that are the keys
              //of their referenced values.
              //Ex: "US/Central": "America/Chicago"
              if (isNaN(arr[0])) {
                _this.zones[arr[1]] = arr[0];
              }
              else {
                _this.zones[arr[1]] = parseInt(arr[0], 10);
              }
              break;
          }
        }
      }
      return true;
    };
    //Expose transport mechanism and allow overwrite.
    this.transport = _transport;
    this.getTzInfo = function (dt, tz, isUTC) {
      //Lazy-load any zones not yet loaded.
      if (this.loadingScheme === this.loadingSchemes.LAZY_LOAD) {
        //Get the correct region for the zone.
        var zoneFile = getRegionForTimezone(tz);
        if (!zoneFile) {
          throw new Error('Not a valid timezone ID.');
        }
        //Get the file and parse it -- use synchronous XHR.
        this.loadZoneFiles(zoneFile);
      }
      var z = getZone(dt, tz);
      var off = +z[0];
      //See if the offset needs adjustment.
      var rule = getRule(dt, z, isUTC);
      if (rule) {
        off = getAdjustedOffset(off, rule[6]);
      }
      var abbr = getAbbreviation(z, rule);
      return { tzOffset: off, tzAbbr: abbr };
    };
  }();
}).call(typeof window !== "undefined" ? window : this);

},{"fs":2}],19:[function(require,module,exports){
module.exports={"zones":{"Africa/Algiers":[["-12.2","-","LMT","-2486678340000"],["-9.35","-","PMT","-1855958400000"],["0","Algeria","WE%sT","-942012000000"],["-60","Algeria","CE%sT","-733276800000"],["0","-","WET","-439430400000"],["-60","-","CET","-212025600000"],["0","Algeria","WE%sT","246240000000"],["-60","Algeria","CE%sT","309744000000"],["0","Algeria","WE%sT","357523200000"],["-60","-","CET",null]],"Atlantic/Cape_Verde":[["94.06666666666668","-","LMT","-1956700800000"],["120","-","-02","-862617600000"],["120","1:00","-01","-764121600000"],["120","-","-02","186112800000"],["60","-","-01",null]],"Africa/Ndjamena":[["-60.2","-","LMT","-1798848000000"],["-60","-","WAT","308707200000"],["-60","1:00","WAST","321321600000"],["-60","-","WAT",null]],"Africa/Abidjan":[["16.133333333333333","-","LMT","-1798848000000"],["0","-","GMT",null]],"Africa/Bamako":"Africa/Abidjan","Africa/Banjul":"Africa/Abidjan","Africa/Conakry":"Africa/Abidjan","Africa/Dakar":"Africa/Abidjan","Africa/Freetown":"Africa/Abidjan","Africa/Lome":"Africa/Abidjan","Africa/Nouakchott":"Africa/Abidjan","Africa/Ouagadougou":"Africa/Abidjan","Atlantic/St_Helena":"Africa/Abidjan","Africa/Cairo":[["-125.15","-","LMT","-2185401600000"],["-120","Egypt","EE%sT",null]],"Africa/Accra":[["0.8666666666666666","-","LMT","-1609545600000"],["0","Ghana","GMT/+0020",null]],"Africa/Bissau":[["62.333333333333336","-","LMT","-1830384000000"],["60","-","-01","189216000000"],["0","-","GMT",null]],"Africa/Nairobi":[["-147.26666666666665","-","LMT","-1309737600000"],["-180","-","EAT","-1230854400000"],["-150","-","+0230","-915235200000"],["-165","-","+0245","-284083200000"],["-180","-","EAT",null]],"Africa/Addis_Ababa":"Africa/Nairobi","Africa/Asmara":"Africa/Nairobi","Africa/Dar_es_Salaam":"Africa/Nairobi","Africa/Djibouti":"Africa/Nairobi","Africa/Kampala":"Africa/Nairobi","Africa/Mogadishu":"Africa/Nairobi","Indian/Antananarivo":"Africa/Nairobi","Indian/Comoro":"Africa/Nairobi","Indian/Mayotte":"Africa/Nairobi","Africa/Monrovia":[["43.13333333333333","-","LMT","-2745532800000"],["43.13333333333333","-","MMT","-1604361600000"],["44.5","-","MMT","63590400000"],["0","-","GMT",null]],"Africa/Tripoli":[["-52.733333333333334","-","LMT","-1546387200000"],["-60","Libya","CE%sT","-315705600000"],["-120","-","EET","410140800000"],["-60","Libya","CE%sT","641779200000"],["-120","-","EET","844041600000"],["-60","Libya","CE%sT","875923200000"],["-120","-","EET","1352512800000"],["-60","Libya","CE%sT","1382666400000"],["-120","-","EET",null]],"Indian/Mauritius":[["-230","-","LMT","-1956700800000"],["-240","Mauritius","+04/+05",null]],"Africa/Casablanca":[["30.333333333333332","-","LMT","-1773014400000"],["0","Morocco","WE%sT","448243200000"],["-60","-","CET","536371200000"],["0","Morocco","WE%sT",null]],"Africa/El_Aaiun":[["52.8","-","LMT","-1136073600000"],["60","-","-01","198288000000"],["0","Morocco","WE%sT",null]],"Africa/Maputo":[["-130.33333333333331","-","LMT","-2109283200000"],["-120","-","CAT",null]],"Africa/Blantyre":"Africa/Maputo","Africa/Bujumbura":"Africa/Maputo","Africa/Gaborone":"Africa/Maputo","Africa/Harare":"Africa/Maputo","Africa/Kigali":"Africa/Maputo","Africa/Lubumbashi":"Africa/Maputo","Africa/Lusaka":"Africa/Maputo","Africa/Windhoek":[["-68.4","-","LMT","-2458166400000"],["-90","-","+0130","-2109283200000"],["-120","-","SAST","-860968800000"],["-120","1:00","SAST","-845244000000"],["-120","-","SAST","637977600000"],["-120","-","CAT","764208000000"],["-60","Namibia","WA%sT","1504404000000"],["-120","-","CAT",null]],"Africa/Lagos":[["-13.6","-","LMT","-1588464000000"],["-60","-","WAT",null]],"Africa/Bangui":"Africa/Lagos","Africa/Brazzaville":"Africa/Lagos","Africa/Douala":"Africa/Lagos","Africa/Kinshasa":"Africa/Lagos","Africa/Libreville":"Africa/Lagos","Africa/Luanda":"Africa/Lagos","Africa/Malabo":"Africa/Lagos","Africa/Niamey":"Africa/Lagos","Africa/Porto-Novo":"Africa/Lagos","Indian/Reunion":[["-221.86666666666665","-","LMT","-1848873600000"],["-240","-","+04",null]],"Africa/Sao_Tome":[["-26.933333333333334","-","LMT","-2682374400000"],["36.75","-","LMT","-1798848000000"],["0","-","GMT","1514768400000"],["-60","-","WAT",null]],"Indian/Mahe":[["-221.8","-","LMT","-2006640000000"],["-240","-","+04",null]],"Africa/Johannesburg":[["-112","-","LMT","-2458166400000"],["-90","-","SAST","-2109283200000"],["-120","SA","SAST",null]],"Africa/Maseru":"Africa/Johannesburg","Africa/Mbabane":"Africa/Johannesburg","Africa/Khartoum":[["-130.13333333333333","-","LMT","-1199318400000"],["-120","Sudan","CA%sT","947937600000"],["-180","-","EAT","1509494400000"],["-120","-","CAT",null]],"Africa/Juba":[["-126.46666666666667","-","LMT","-1199318400000"],["-120","Sudan","CA%sT","947937600000"],["-180","-","EAT",null]],"Africa/Tunis":[["-40.733333333333334","-","LMT","-2797200000000"],["-9.35","-","PMT","-1855958400000"],["-60","Tunisia","CE%sT",null]],"Antarctica/Casey":[["0","-","-00","-86400000"],["-480","-","+08","1255831200000"],["-660","-","+11","1267754400000"],["-480","-","+08","1319767200000"],["-660","-","+11","1329843600000"],["-480","-","+08","1477094400000"],["-660","-","+11",null]],"Antarctica/Davis":[["0","-","-00","-409190400000"],["-420","-","+07","-163036800000"],["0","-","-00","-28857600000"],["-420","-","+07","1255831200000"],["-300","-","+05","1268251200000"],["-420","-","+07","1319767200000"],["-300","-","+05","1329854400000"],["-420","-","+07",null]],"Antarctica/Mawson":[["0","-","-00","-501206400000"],["-360","-","+06","1255831200000"],["-300","-","+05",null]],"Indian/Kerguelen":[["0","-","-00","-599702400000"],["-300","-","+05",null]],"Antarctica/DumontDUrville":[["0","-","-00","-694396800000"],["-600","-","+10","-566956800000"],["0","-","-00","-415497600000"],["-600","-","+10",null]],"Antarctica/Syowa":[["0","-","-00","-407808000000"],["-180","-","+03",null]],"Antarctica/Troll":[["0","-","-00","1108166400000"],["0","Troll","%s",null]],"Antarctica/Vostok":[["0","-","-00","-380073600000"],["-360","-","+06",null]],"Antarctica/Rothera":[["0","-","-00","218246400000"],["180","-","-03",null]],"Asia/Kabul":[["-276.8","-","LMT","-2493072000000"],["-240","-","+04","-757468800000"],["-270","-","+0430",null]],"Asia/Yerevan":[["-178","-","LMT","-1441152000000"],["-180","-","+03","-405129600000"],["-240","RussiaAsia","+04/+05","670384800000"],["-180","RussiaAsia","+03/+04","811908000000"],["-240","-","+04","883526400000"],["-240","RussiaAsia","+04/+05","1325289600000"],["-240","Armenia","+04/+05",null]],"Asia/Baku":[["-199.4","-","LMT","-1441152000000"],["-180","-","+03","-405129600000"],["-240","RussiaAsia","+04/+05","670384800000"],["-180","RussiaAsia","+03/+04","715312800000"],["-240","-","+04","851990400000"],["-240","EUAsia","+04/+05","883526400000"],["-240","Azer","+04/+05",null]],"Asia/Dhaka":[["-361.6666666666667","-","LMT","-2493072000000"],["-353.3333333333333","-","HMT","-891561600000"],["-390","-","+0630","-872035200000"],["-330","-","+0530","-862617600000"],["-390","-","+0630","-576115200000"],["-360","-","+06","1262217600000"],["-360","Dhaka","+06/+07",null]],"Asia/Thimphu":[["-358.6","-","LMT","-706320000000"],["-330","-","+0530","560044800000"],["-360","-","+06",null]],"Indian/Chagos":[["-289.6666666666667","-","LMT","-1956700800000"],["-300","-","+05","851990400000"],["-360","-","+06",null]],"Asia/Brunei":[["-459.6666666666667","-","LMT","-1383436800000"],["-450","-","+0730","-1136160000000"],["-480","-","+08",null]],"Asia/Yangon":[["-384.7833333333333","-","LMT","-2808604800000"],["-384.7833333333333","-","RMT","-1546387200000"],["-390","-","+0630","-873244800000"],["-540","-","+09","-778377600000"],["-390","-","+0630",null]],"Asia/Shanghai":[["-485.7166666666667","-","LMT","-2146003200000"],["-480","Shang","C%sT","-631238400000"],["-480","PRC","C%sT",null]],"Asia/Urumqi":[["-350.3333333333333","-","LMT","-1293926400000"],["-360","-","+06",null]],"Asia/Hong_Kong":[["-456.7","-","LMT","-2056665600000"],["-480","HK","HK%sT","-884217600000"],["-540","-","JST","-766713600000"],["-480","HK","HK%sT",null]],"Asia/Taipei":[["-486","-","LMT","-2335219200000"],["-480","-","CST","-1017792000000"],["-540","-","JST","-766191600000"],["-480","Taiwan","C%sT",null]],"Asia/Macau":[["-454.3333333333333","-","LMT","-1830384000000"],["-480","Macau","C%sT",null]],"Asia/Nicosia":[["-133.46666666666667","-","LMT","-1518912000000"],["-120","Cyprus","EE%sT","904608000000"],["-120","EUAsia","EE%sT",null]],"Asia/Famagusta":[["-135.8","-","LMT","-1518912000000"],["-120","Cyprus","EE%sT","904608000000"],["-120","EUAsia","EE%sT","1473292800000"],["-180","-","+03","1509238800000"],["-120","EUAsia","EE%sT",null]],"Europe/Nicosia":"Asia/Nicosia","Asia/Tbilisi":[["-179.18333333333334","-","LMT","-2808604800000"],["-179.18333333333334","-","TBMT","-1441152000000"],["-180","-","+03","-405129600000"],["-240","RussiaAsia","+04/+05","670384800000"],["-180","RussiaAsia","+03/+04","725760000000"],["-180","E-EurAsia","+03/+04","778377600000"],["-240","E-EurAsia","+04/+05","844128000000"],["-240","1:00","+05","857174400000"],["-240","E-EurAsia","+04/+05","1088294400000"],["-180","RussiaAsia","+03/+04","1109642400000"],["-240","-","+04",null]],"Asia/Dili":[["-502.3333333333333","-","LMT","-1830384000000"],["-480","-","+08","-879123600000"],["-540","-","+09","199929600000"],["-480","-","+08","969148800000"],["-540","-","+09",null]],"Asia/Kolkata":[["-353.4666666666667","-","LMT","-3645216000000"],["-353.3333333333333","-","HMT","-3124224000000"],["-321.1666666666667","-","MMT","-2019686400000"],["-330","-","IST","-891561600000"],["-330","1:00","+0630","-872035200000"],["-330","-","IST","-862617600000"],["-330","1:00","+0630","-764121600000"],["-330","-","IST",null]],"Asia/Jakarta":[["-427.2","-","LMT","-3231273600000"],["-427.2","-","BMT","-1451693568000"],["-440","-","+0720","-1172880000000"],["-450","-","+0730","-876614400000"],["-540","-","+09","-766022400000"],["-450","-","+0730","-683856000000"],["-480","-","+08","-620784000000"],["-450","-","+0730","-157852800000"],["-420","-","WIB",null]],"Asia/Pontianak":[["-437.3333333333333","-","LMT","-1946160000000"],["-437.3333333333333","-","PMT","-1172880000000"],["-450","-","+0730","-881193600000"],["-540","-","+09","-766022400000"],["-450","-","+0730","-683856000000"],["-480","-","+08","-620784000000"],["-450","-","+0730","-157852800000"],["-480","-","WITA","567993600000"],["-420","-","WIB",null]],"Asia/Makassar":[["-477.6","-","LMT","-1546387200000"],["-477.6","-","MMT","-1172880000000"],["-480","-","+08","-880243200000"],["-540","-","+09","-766022400000"],["-480","-","WITA",null]],"Asia/Jayapura":[["-562.8","-","LMT","-1172880000000"],["-540","-","+09","-799459200000"],["-570","-","+0930","-157852800000"],["-540","-","WIT",null]],"Asia/Tehran":[["-205.73333333333335","-","LMT","-1672617600000"],["-205.73333333333335","-","TMT","-725932800000"],["-210","-","+0330","247190400000"],["-240","Iran","+04/+05","315446400000"],["-210","Iran","+0330/+0430",null]],"Asia/Baghdad":[["-177.66666666666666","-","LMT","-2493072000000"],["-177.6","-","BMT","-1609545600000"],["-180","-","+03","389059200000"],["-180","Iraq","+03/+04",null]],"Asia/Jerusalem":[["-140.9","-","LMT","-2808604800000"],["-140.66666666666666","-","JMT","-1609545600000"],["-120","Zion","I%sT",null]],"Asia/Tokyo":[["-558.9833333333333","-","LMT","-2587712400000"],["-540","Japan","J%sT",null]],"Asia/Amman":[["-143.73333333333335","-","LMT","-1199318400000"],["-120","Jordan","EE%sT",null]],"Asia/Almaty":[["-307.8","-","LMT","-1441152000000"],["-300","-","+05","-1247529600000"],["-360","RussiaAsia","+06/+07","670384800000"],["-300","RussiaAsia","+05/+06","695786400000"],["-360","RussiaAsia","+06/+07","1099188000000"],["-360","-","+06",null]],"Asia/Qyzylorda":[["-261.8666666666667","-","LMT","-1441152000000"],["-240","-","+04","-1247529600000"],["-300","-","+05","354931200000"],["-300","1:00","+06","370742400000"],["-360","-","+06","386467200000"],["-300","RussiaAsia","+05/+06","670384800000"],["-240","RussiaAsia","+04/+05","686109600000"],["-300","RussiaAsia","+05/+06","695786400000"],["-360","RussiaAsia","+06/+07","701834400000"],["-300","RussiaAsia","+05/+06","1099188000000"],["-360","-","+06",null]],"Asia/Aqtobe":[["-228.66666666666666","-","LMT","-1441152000000"],["-240","-","+04","-1247529600000"],["-300","-","+05","354931200000"],["-300","1:00","+06","370742400000"],["-360","-","+06","386467200000"],["-300","RussiaAsia","+05/+06","670384800000"],["-240","RussiaAsia","+04/+05","695786400000"],["-300","RussiaAsia","+05/+06","1099188000000"],["-300","-","+05",null]],"Asia/Aqtau":[["-201.06666666666666","-","LMT","-1441152000000"],["-240","-","+04","-1247529600000"],["-300","-","+05","370742400000"],["-360","-","+06","386467200000"],["-300","RussiaAsia","+05/+06","670384800000"],["-240","RussiaAsia","+04/+05","695786400000"],["-300","RussiaAsia","+05/+06","780458400000"],["-240","RussiaAsia","+04/+05","1099188000000"],["-300","-","+05",null]],"Asia/Atyrau":[["-207.73333333333335","-","LMT","-1441152000000"],["-180","-","+03","-1247529600000"],["-300","-","+05","370742400000"],["-360","-","+06","386467200000"],["-300","RussiaAsia","+05/+06","670384800000"],["-240","RussiaAsia","+04/+05","695786400000"],["-300","RussiaAsia","+05/+06","922586400000"],["-240","RussiaAsia","+04/+05","1099188000000"],["-300","-","+05",null]],"Asia/Oral":[["-205.4","-","LMT","-1441152000000"],["-180","-","+03","-1247529600000"],["-300","-","+05","354931200000"],["-300","1:00","+06","370742400000"],["-360","-","+06","386467200000"],["-300","RussiaAsia","+05/+06","606880800000"],["-240","RussiaAsia","+04/+05","695786400000"],["-300","RussiaAsia","+05/+06","701834400000"],["-240","RussiaAsia","+04/+05","1099188000000"],["-300","-","+05",null]],"Asia/Bishkek":[["-298.4","-","LMT","-1441152000000"],["-300","-","+05","-1247529600000"],["-360","RussiaAsia","+06/+07","670384800000"],["-300","RussiaAsia","+05/+06","683604000000"],["-300","Kyrgyz","+05/+06","1123804800000"],["-360","-","+06",null]],"Asia/Seoul":[["-507.8666666666667","-","LMT","-1948752000000"],["-510","-","KST","-1830384000000"],["-540","-","JST","-767318400000"],["-540","-","KST","-498096000000"],["-510","ROK","K%sT","-264902400000"],["-540","ROK","K%sT",null]],"Asia/Pyongyang":[["-503","-","LMT","-1948752000000"],["-510","-","KST","-1830384000000"],["-540","-","JST","-768614400000"],["-540","-","KST","1439596800000"],["-510","-","KST",null]],"Asia/Beirut":[["-142","-","LMT","-2808604800000"],["-120","Lebanon","EE%sT",null]],"Asia/Kuala_Lumpur":[["-406.7666666666667","-","LMT","-2177452800000"],["-415.4166666666667","-","SMT","-2038176000000"],["-420","-","+07","-1167609600000"],["-420","0:20","+0720","-1073001600000"],["-440","-","+0720","-894153600000"],["-450","-","+0730","-879638400000"],["-540","-","+09","-766972800000"],["-450","-","+0730","378691200000"],["-480","-","+08",null]],"Asia/Kuching":[["-441.3333333333333","-","LMT","-1383436800000"],["-450","-","+0730","-1136160000000"],["-480","NBorneo","+08/+0820","-879638400000"],["-540","-","+09","-766972800000"],["-480","-","+08",null]],"Indian/Maldives":[["-294","-","LMT","-2808604800000"],["-294","-","MMT","-284083200000"],["-300","-","+05",null]],"Asia/Hovd":[["-366.6","-","LMT","-2032905600000"],["-360","-","+06","283910400000"],["-420","Mongol","+07/+08",null]],"Asia/Ulaanbaatar":[["-427.5333333333333","-","LMT","-2032905600000"],["-420","-","+07","283910400000"],["-480","Mongol","+08/+09",null]],"Asia/Choibalsan":[["-458","-","LMT","-2032905600000"],["-420","-","+07","283910400000"],["-480","-","+08","418003200000"],["-540","Mongol","+09/+10","1206921600000"],["-480","Mongol","+08/+09",null]],"Asia/Kathmandu":[["-341.2666666666667","-","LMT","-1546387200000"],["-330","-","+0530","536371200000"],["-345","-","+0545",null]],"Asia/Karachi":[["-268.2","-","LMT","-1956700800000"],["-330","-","+0530","-862617600000"],["-330","1:00","+0630","-764121600000"],["-330","-","+0530","-576115200000"],["-300","-","+05","38793600000"],["-300","Pakistan","PK%sT",null]],"Asia/Gaza":[["-137.86666666666665","-","LMT","-2185401600000"],["-120","Zion","EET/EEST","-682646400000"],["-120","EgyptAsia","EE%sT","-81302400000"],["-120","Zion","I%sT","851990400000"],["-120","Jordan","EE%sT","946598400000"],["-120","Palestine","EE%sT","1219968000000"],["-120","-","EET","1220227200000"],["-120","Palestine","EE%sT","1293753600000"],["-120","-","EET","1269648060000"],["-120","Palestine","EE%sT","1312156800000"],["-120","-","EET","1356912000000"],["-120","Palestine","EE%sT",null]],"Asia/Hebron":[["-140.38333333333335","-","LMT","-2185401600000"],["-120","Zion","EET/EEST","-682646400000"],["-120","EgyptAsia","EE%sT","-81302400000"],["-120","Zion","I%sT","851990400000"],["-120","Jordan","EE%sT","946598400000"],["-120","Palestine","EE%sT",null]],"Asia/Manila":[["956","-","LMT","-3944678400000"],["-484","-","LMT","-2229292800000"],["-480","Phil","+08/+09","-873244800000"],["-540","-","+09","-794188800000"],["-480","Phil","+08/+09",null]],"Asia/Qatar":[["-206.13333333333335","-","LMT","-1546387200000"],["-240","-","+04","76204800000"],["-180","-","+03",null]],"Asia/Bahrain":"Asia/Qatar","Asia/Riyadh":[["-186.86666666666665","-","LMT","-719625600000"],["-180","-","+03",null]],"Asia/Aden":"Asia/Riyadh","Asia/Kuwait":"Asia/Riyadh","Asia/Singapore":[["-415.4166666666667","-","LMT","-2177452800000"],["-415.4166666666667","-","SMT","-2038176000000"],["-420","-","+07","-1167609600000"],["-420","0:20","+0720","-1073001600000"],["-440","-","+0720","-894153600000"],["-450","-","+0730","-879638400000"],["-540","-","+09","-766972800000"],["-450","-","+0730","378691200000"],["-480","-","+08",null]],"Asia/Colombo":[["-319.4","-","LMT","-2808604800000"],["-319.5333333333333","-","MMT","-1988236800000"],["-330","-","+0530","-883267200000"],["-330","0:30","+06","-862617600000"],["-330","1:00","+0630","-764028000000"],["-330","-","+0530","832982400000"],["-390","-","+0630","846289800000"],["-360","-","+06","1145061000000"],["-330","-","+0530",null]],"Asia/Damascus":[["-145.2","-","LMT","-1546387200000"],["-120","Syria","EE%sT",null]],"Asia/Dushanbe":[["-275.2","-","LMT","-1441152000000"],["-300","-","+05","-1247529600000"],["-360","RussiaAsia","+06/+07","670384800000"],["-300","1:00","+05/+06","684381600000"],["-300","-","+05",null]],"Asia/Bangkok":[["-402.06666666666666","-","LMT","-2808604800000"],["-402.06666666666666","-","BMT","-1570060800000"],["-420","-","+07",null]],"Asia/Phnom_Penh":"Asia/Bangkok","Asia/Vientiane":"Asia/Bangkok","Asia/Ashgabat":[["-233.53333333333333","-","LMT","-1441152000000"],["-240","-","+04","-1247529600000"],["-300","RussiaAsia","+05/+06","670384800000"],["-240","RussiaAsia","+04/+05","695786400000"],["-300","-","+05",null]],"Asia/Dubai":[["-221.2","-","LMT","-1546387200000"],["-240","-","+04",null]],"Asia/Muscat":"Asia/Dubai","Asia/Samarkand":[["-267.8833333333333","-","LMT","-1441152000000"],["-240","-","+04","-1247529600000"],["-300","-","+05","354931200000"],["-300","1:00","+06","370742400000"],["-360","-","+06","386467200000"],["-300","RussiaAsia","+05/+06","725760000000"],["-300","-","+05",null]],"Asia/Tashkent":[["-277.18333333333334","-","LMT","-1441152000000"],["-300","-","+05","-1247529600000"],["-360","RussiaAsia","+06/+07","670384800000"],["-300","RussiaAsia","+05/+06","725760000000"],["-300","-","+05",null]],"Asia/Ho_Chi_Minh":[["-426.6666666666667","-","LMT","-2004048000000"],["-426.5","-","PLMT","-1851552000000"],["-420","-","+07","-852080400000"],["-480","-","+08","-782614800000"],["-540","-","+09","-767836800000"],["-420","-","+07","-718070400000"],["-480","-","+08","-457747200000"],["-420","-","+07","-315622800000"],["-480","-","+08","171849600000"],["-420","-","+07",null]],"Australia/Darwin":[["-523.3333333333333","-","LMT","-2364076800000"],["-540","-","ACST","-2230156800000"],["-570","Aus","AC%sT",null]],"Australia/Perth":[["-463.4","-","LMT","-2337897600000"],["-480","Aus","AW%sT","-836438400000"],["-480","AW","AW%sT",null]],"Australia/Eucla":[["-515.4666666666667","-","LMT","-2337897600000"],["-525","Aus","+0845/+0945","-836438400000"],["-525","AW","+0845/+0945",null]],"Australia/Brisbane":[["-612.1333333333333","-","LMT","-2335305600000"],["-600","Aus","AE%sT","62985600000"],["-600","AQ","AE%sT",null]],"Australia/Lindeman":[["-595.9333333333334","-","LMT","-2335305600000"],["-600","Aus","AE%sT","62985600000"],["-600","AQ","AE%sT","709948800000"],["-600","Holiday","AE%sT",null]],"Australia/Adelaide":[["-554.3333333333334","-","LMT","-2364076800000"],["-540","-","ACST","-2230156800000"],["-570","Aus","AC%sT","62985600000"],["-570","AS","AC%sT",null]],"Australia/Hobart":[["-589.2666666666667","-","LMT","-2345760000000"],["-600","-","AEST","-1680472800000"],["-600","1:00","AEDT","-1669852800000"],["-600","Aus","AE%sT","-63244800000"],["-600","AT","AE%sT",null]],"Australia/Currie":[["-575.4666666666666","-","LMT","-2345760000000"],["-600","-","AEST","-1680472800000"],["-600","1:00","AEDT","-1669852800000"],["-600","Aus","AE%sT","47174400000"],["-600","AT","AE%sT",null]],"Australia/Melbourne":[["-579.8666666666667","-","LMT","-2364076800000"],["-600","Aus","AE%sT","62985600000"],["-600","AV","AE%sT",null]],"Australia/Sydney":[["-604.8666666666667","-","LMT","-2364076800000"],["-600","Aus","AE%sT","62985600000"],["-600","AN","AE%sT",null]],"Australia/Broken_Hill":[["-565.8","-","LMT","-2364076800000"],["-600","-","AEST","-2314915200000"],["-540","-","ACST","-2230156800000"],["-570","Aus","AC%sT","62985600000"],["-570","AN","AC%sT","978220800000"],["-570","AS","AC%sT",null]],"Australia/Lord_Howe":[["-636.3333333333334","-","LMT","-2364076800000"],["-600","-","AEST","352252800000"],["-630","LH","+1030/+1130","489024000000"],["-630","LH","+1030/+11",null]],"Antarctica/Macquarie":[["0","-","-00","-2214259200000"],["-600","-","AEST","-1680472800000"],["-600","1:00","AEDT","-1669852800000"],["-600","Aus","AE%sT","-1601683200000"],["0","-","-00","-687052800000"],["-600","Aus","AE%sT","-63244800000"],["-600","AT","AE%sT","1270350000000"],["-660","-","+11",null]],"Indian/Christmas":[["-422.8666666666667","-","LMT","-2364076800000"],["-420","-","+07",null]],"Indian/Cocos":[["-387.6666666666667","-","LMT","-2177539200000"],["-390","-","+0630",null]],"Pacific/Fiji":[["-715.7333333333333","-","LMT","-1709942400000"],["-720","Fiji","+12/+13",null]],"Pacific/Gambier":[["539.8","-","LMT","-1806710400000"],["540","-","-09",null]],"Pacific/Marquesas":[["558","-","LMT","-1806710400000"],["570","-","-0930",null]],"Pacific/Tahiti":[["598.2666666666667","-","LMT","-1806710400000"],["600","-","-10",null]],"Pacific/Guam":[["861","-","LMT","-3944678400000"],["-579","-","LMT","-2146003200000"],["-600","-","GST","977529600000"],["-600","-","ChST",null]],"Pacific/Saipan":"Pacific/Guam","Pacific/Tarawa":[["-692.0666666666666","-","LMT","-2146003200000"],["-720","-","+12",null]],"Pacific/Enderbury":[["684.3333333333334","-","LMT","-2146003200000"],["720","-","-12","307584000000"],["660","-","-11","820368000000"],["-780","-","+13",null]],"Pacific/Kiritimati":[["629.3333333333334","-","LMT","-2146003200000"],["640","-","-1040","307584000000"],["600","-","-10","820368000000"],["-840","-","+14",null]],"Pacific/Majuro":[["-684.8","-","LMT","-2146003200000"],["-660","-","+11","-7948800000"],["-720","-","+12",null]],"Pacific/Kwajalein":[["-669.3333333333334","-","LMT","-2146003200000"],["-660","-","+11","-7948800000"],["720","-","-12","745804800000"],["-720","-","+12",null]],"Pacific/Chuuk":[["-607.1333333333333","-","LMT","-2146003200000"],["-600","-","+10",null]],"Pacific/Pohnpei":[["-632.8666666666667","-","LMT","-2146003200000"],["-660","-","+11",null]],"Pacific/Kosrae":[["-651.9333333333334","-","LMT","-2146003200000"],["-660","-","+11","-7948800000"],["-720","-","+12","946598400000"],["-660","-","+11",null]],"Pacific/Nauru":[["-667.6666666666666","-","LMT","-1545091200000"],["-690","-","+1130","-877305600000"],["-540","-","+09","-800928000000"],["-690","-","+1130","294364800000"],["-720","-","+12",null]],"Pacific/Noumea":[["-665.8","-","LMT","-1829347200000"],["-660","NC","+11/+12",null]],"Pacific/Auckland":[["-699.0666666666666","-","LMT","-3192393600000"],["-690","NZ","NZ%sT","-757382400000"],["-720","NZ","NZ%sT",null]],"Pacific/Chatham":[["-733.8","-","LMT","-3192393600000"],["-735","-","+1215","-757382400000"],["-765","Chatham","+1245/+1345",null]],"Antarctica/McMurdo":"Pacific/Auckland","Pacific/Rarotonga":[["639.0666666666666","-","LMT","-2146003200000"],["630","-","-1030","279676800000"],["600","Cook","-10/-0930",null]],"Pacific/Niue":[["679.6666666666666","-","LMT","-2146003200000"],["680","-","-1120","-568166400000"],["690","-","-1130","276048000000"],["660","-","-11",null]],"Pacific/Norfolk":[["-671.8666666666667","-","LMT","-2146003200000"],["-672","-","+1112","-568166400000"],["-690","-","+1130","152071200000"],["-690","1:00","+1230","162957600000"],["-690","-","+1130","1443924000000"],["-660","-","+11",null]],"Pacific/Palau":[["-537.9333333333334","-","LMT","-2146003200000"],["-540","-","+09",null]],"Pacific/Port_Moresby":[["-588.6666666666666","-","LMT","-2808604800000"],["-588.5333333333334","-","PMMT","-2335305600000"],["-600","-","+10",null]],"Pacific/Bougainville":[["-622.2666666666667","-","LMT","-2808604800000"],["-588.5333333333334","-","PMMT","-2335305600000"],["-600","-","+10","-867974400000"],["-540","-","+09","-768873600000"],["-600","-","+10","1419732000000"],["-660","-","+11",null]],"Pacific/Pitcairn":[["520.3333333333333","-","LMT","-2146003200000"],["510","-","-0830","893635200000"],["480","-","-08",null]],"Pacific/Pago_Pago":[["-757.2","-","LMT","-2445379200000"],["682.8","-","LMT","-1830470400000"],["660","-","SST",null]],"Pacific/Midway":"Pacific/Pago_Pago","Pacific/Apia":[["-753.0666666666666","-","LMT","-2445379200000"],["686.9333333333334","-","LMT","-1830470400000"],["690","-","-1130","-599702400000"],["660","WS","-11/-10","1325203200000"],["-780","WS","+13/+14",null]],"Pacific/Guadalcanal":[["-639.8","-","LMT","-1806710400000"],["-660","-","+11",null]],"Pacific/Fakaofo":[["684.9333333333334","-","LMT","-2146003200000"],["660","-","-11","1325203200000"],["-780","-","+13",null]],"Pacific/Tongatapu":[["-739.3333333333334","-","LMT","-2146003200000"],["-740","-","+1220","-883699200000"],["-780","-","+13","946598400000"],["-780","Tonga","+13/+14",null]],"Pacific/Funafuti":[["-716.8666666666667","-","LMT","-2146003200000"],["-720","-","+12",null]],"Pacific/Wake":[["-666.4666666666666","-","LMT","-2146003200000"],["-720","-","+12",null]],"Pacific/Efate":[["-673.2666666666667","-","LMT","-1829347200000"],["-660","Vanuatu","+11/+12",null]],"Pacific/Wallis":[["-735.3333333333334","-","LMT","-2146003200000"],["-720","-","+12",null]],"Africa/Asmera":"Africa/Nairobi","Africa/Timbuktu":"Africa/Abidjan","America/Argentina/ComodRivadavia":"America/Argentina/Catamarca","America/Atka":"America/Adak","America/Buenos_Aires":"America/Argentina/Buenos_Aires","America/Catamarca":"America/Argentina/Catamarca","America/Coral_Harbour":"America/Atikokan","America/Cordoba":"America/Argentina/Cordoba","America/Ensenada":"America/Tijuana","America/Fort_Wayne":"America/Indiana/Indianapolis","America/Indianapolis":"America/Indiana/Indianapolis","America/Jujuy":"America/Argentina/Jujuy","America/Knox_IN":"America/Indiana/Knox","America/Louisville":"America/Kentucky/Louisville","America/Mendoza":"America/Argentina/Mendoza","America/Montreal":"America/Toronto","America/Porto_Acre":"America/Rio_Branco","America/Rosario":"America/Argentina/Cordoba","America/Santa_Isabel":"America/Tijuana","America/Shiprock":"America/Denver","America/Virgin":"America/Port_of_Spain","Antarctica/South_Pole":"Pacific/Auckland","Asia/Ashkhabad":"Asia/Ashgabat","Asia/Calcutta":"Asia/Kolkata","Asia/Chongqing":"Asia/Shanghai","Asia/Chungking":"Asia/Shanghai","Asia/Dacca":"Asia/Dhaka","Asia/Harbin":"Asia/Shanghai","Asia/Kashgar":"Asia/Urumqi","Asia/Katmandu":"Asia/Kathmandu","Asia/Macao":"Asia/Macau","Asia/Rangoon":"Asia/Yangon","Asia/Saigon":"Asia/Ho_Chi_Minh","Asia/Tel_Aviv":"Asia/Jerusalem","Asia/Thimbu":"Asia/Thimphu","Asia/Ujung_Pandang":"Asia/Makassar","Asia/Ulan_Bator":"Asia/Ulaanbaatar","Atlantic/Faeroe":"Atlantic/Faroe","Atlantic/Jan_Mayen":"Europe/Oslo","Australia/ACT":"Australia/Sydney","Australia/Canberra":"Australia/Sydney","Australia/LHI":"Australia/Lord_Howe","Australia/NSW":"Australia/Sydney","Australia/North":"Australia/Darwin","Australia/Queensland":"Australia/Brisbane","Australia/South":"Australia/Adelaide","Australia/Tasmania":"Australia/Hobart","Australia/Victoria":"Australia/Melbourne","Australia/West":"Australia/Perth","Australia/Yancowinna":"Australia/Broken_Hill","Brazil/Acre":"America/Rio_Branco","Brazil/DeNoronha":"America/Noronha","Brazil/East":"America/Sao_Paulo","Brazil/West":"America/Manaus","Canada/Atlantic":"America/Halifax","Canada/Central":"America/Winnipeg","Canada/Eastern":"America/Toronto","Canada/Mountain":"America/Edmonton","Canada/Newfoundland":"America/St_Johns","Canada/Pacific":"America/Vancouver","Canada/Saskatchewan":"America/Regina","Canada/Yukon":"America/Whitehorse","Chile/Continental":"America/Santiago","Chile/EasterIsland":"Pacific/Easter","Cuba":"America/Havana","Egypt":"Africa/Cairo","Eire":"Europe/Dublin","Europe/Belfast":"Europe/London","Europe/Tiraspol":"Europe/Chisinau","GB":"Europe/London","GB-Eire":"Europe/London","GMT+0":"Etc/GMT","GMT-0":"Etc/GMT","GMT0":"Etc/GMT","Greenwich":"Etc/GMT","Hongkong":"Asia/Hong_Kong","Iceland":"Atlantic/Reykjavik","Iran":"Asia/Tehran","Israel":"Asia/Jerusalem","Jamaica":"America/Jamaica","Japan":"Asia/Tokyo","Kwajalein":"Pacific/Kwajalein","Libya":"Africa/Tripoli","Mexico/BajaNorte":"America/Tijuana","Mexico/BajaSur":"America/Mazatlan","Mexico/General":"America/Mexico_City","NZ":"Pacific/Auckland","NZ-CHAT":"Pacific/Chatham","Navajo":"America/Denver","PRC":"Asia/Shanghai","Pacific/Johnston":"Pacific/Honolulu","Pacific/Ponape":"Pacific/Pohnpei","Pacific/Samoa":"Pacific/Pago_Pago","Pacific/Truk":"Pacific/Chuuk","Pacific/Yap":"Pacific/Chuuk","Poland":"Europe/Warsaw","Portugal":"Europe/Lisbon","ROC":"Asia/Taipei","ROK":"Asia/Seoul","Singapore":"Asia/Singapore","Turkey":"Europe/Istanbul","UCT":"Etc/UCT","US/Alaska":"America/Anchorage","US/Aleutian":"America/Adak","US/Arizona":"America/Phoenix","US/Central":"America/Chicago","US/East-Indiana":"America/Indiana/Indianapolis","US/Eastern":"America/New_York","US/Hawaii":"Pacific/Honolulu","US/Indiana-Starke":"America/Indiana/Knox","US/Michigan":"America/Detroit","US/Mountain":"America/Denver","US/Pacific":"America/Los_Angeles","US/Samoa":"Pacific/Pago_Pago","UTC":"Etc/UTC","Universal":"Etc/UTC","W-SU":"Europe/Moscow","Zulu":"Etc/UTC","Etc/GMT":[["0","-","GMT",null]],"Etc/UTC":[["0","-","UTC",null]],"Etc/UCT":[["0","-","UCT",null]],"GMT":"Etc/GMT","Etc/Universal":"Etc/UTC","Etc/Zulu":"Etc/UTC","Etc/Greenwich":"Etc/GMT","Etc/GMT-0":"Etc/GMT","Etc/GMT+0":"Etc/GMT","Etc/GMT0":"Etc/GMT","Etc/GMT-14":[["-840","-","+14",null]],"Etc/GMT-13":[["-780","-","+13",null]],"Etc/GMT-12":[["-720","-","+12",null]],"Etc/GMT-11":[["-660","-","+11",null]],"Etc/GMT-10":[["-600","-","+10",null]],"Etc/GMT-9":[["-540","-","+09",null]],"Etc/GMT-8":[["-480","-","+08",null]],"Etc/GMT-7":[["-420","-","+07",null]],"Etc/GMT-6":[["-360","-","+06",null]],"Etc/GMT-5":[["-300","-","+05",null]],"Etc/GMT-4":[["-240","-","+04",null]],"Etc/GMT-3":[["-180","-","+03",null]],"Etc/GMT-2":[["-120","-","+02",null]],"Etc/GMT-1":[["-60","-","+01",null]],"Etc/GMT+1":[["60","-","-01",null]],"Etc/GMT+2":[["120","-","-02",null]],"Etc/GMT+3":[["180","-","-03",null]],"Etc/GMT+4":[["240","-","-04",null]],"Etc/GMT+5":[["300","-","-05",null]],"Etc/GMT+6":[["360","-","-06",null]],"Etc/GMT+7":[["420","-","-07",null]],"Etc/GMT+8":[["480","-","-08",null]],"Etc/GMT+9":[["540","-","-09",null]],"Etc/GMT+10":[["600","-","-10",null]],"Etc/GMT+11":[["660","-","-11",null]],"Etc/GMT+12":[["720","-","-12",null]],"Europe/London":[["1.25","-","LMT","-3852662400000"],["0","GB-Eire","%s","-37238400000"],["-60","-","BST","57722400000"],["0","GB-Eire","%s","851990400000"],["0","EU","GMT/BST",null]],"Europe/Jersey":"Europe/London","Europe/Guernsey":"Europe/London","Europe/Isle_of_Man":"Europe/London","Europe/Dublin":[["25","-","LMT","-2821651200000"],["25.35","-","DMT","-1691964000000"],["25.35","1:00","IST","-1680472800000"],["0","GB-Eire","%s","-1517011200000"],["0","GB-Eire","GMT/IST","-942012000000"],["0","1:00","IST","-733356000000"],["0","-","GMT","-719445600000"],["0","1:00","IST","-699487200000"],["0","-","GMT","-684972000000"],["0","GB-Eire","GMT/IST","-37238400000"],["-60","-","IST","57722400000"],["0","GB-Eire","GMT/IST","851990400000"],["0","EU","GMT/IST",null]],"WET":[["0","EU","WE%sT",null]],"CET":[["-60","C-Eur","CE%sT",null]],"MET":[["-60","C-Eur","ME%sT",null]],"EET":[["-120","EU","EE%sT",null]],"Europe/Tirane":[["-79.33333333333333","-","LMT","-1735776000000"],["-60","-","CET","-932342400000"],["-60","Albania","CE%sT","457488000000"],["-60","EU","CE%sT",null]],"Europe/Andorra":[["-6.066666666666667","-","LMT","-2146003200000"],["0","-","WET","-733881600000"],["-60","-","CET","481082400000"],["-60","EU","CE%sT",null]],"Europe/Vienna":[["-65.35","-","LMT","-2422051200000"],["-60","C-Eur","CE%sT","-1546387200000"],["-60","Austria","CE%sT","-938901600000"],["-60","C-Eur","CE%sT","-781048800000"],["-60","1:00","CEST","-780184800000"],["-60","-","CET","-725932800000"],["-60","Austria","CE%sT","378604800000"],["-60","EU","CE%sT",null]],"Europe/Minsk":[["-110.26666666666667","-","LMT","-2808604800000"],["-110","-","MMT","-1441152000000"],["-120","-","EET","-1247529600000"],["-180","-","MSK","-899769600000"],["-60","C-Eur","CE%sT","-804643200000"],["-180","Russia","MSK/MSD","662601600000"],["-180","-","MSK","670384800000"],["-120","Russia","EE%sT","1301191200000"],["-180","-","+03",null]],"Europe/Brussels":[["-17.5","-","LMT","-2808604800000"],["-17.5","-","BMT","-2450952000000"],["0","-","WET","-1740355200000"],["-60","-","CET","-1693699200000"],["-60","C-Eur","CE%sT","-1613826000000"],["0","Belgium","WE%sT","-934668000000"],["-60","C-Eur","CE%sT","-799286400000"],["-60","Belgium","CE%sT","252374400000"],["-60","EU","CE%sT",null]],"Europe/Sofia":[["-93.26666666666667","-","LMT","-2808604800000"],["-116.93333333333332","-","IMT","-2369520000000"],["-120","-","EET","-857250000000"],["-60","C-Eur","CE%sT","-757468800000"],["-60","-","CET","-781045200000"],["-120","-","EET","291769200000"],["-120","Bulg","EE%sT","401857200000"],["-120","C-Eur","EE%sT","694137600000"],["-120","E-Eur","EE%sT","883526400000"],["-120","EU","EE%sT",null]],"Europe/Prague":[["-57.733333333333334","-","LMT","-3755376000000"],["-57.733333333333334","-","PMT","-2469398400000"],["-60","C-Eur","CE%sT","-798069600000"],["-60","Czech","CE%sT","315446400000"],["-60","EU","CE%sT",null]],"Europe/Copenhagen":[["-50.333333333333336","-","LMT","-2493072000000"],["-50.333333333333336","-","CMT","-2398291200000"],["-60","Denmark","CE%sT","-857253600000"],["-60","C-Eur","CE%sT","-781048800000"],["-60","Denmark","CE%sT","347068800000"],["-60","EU","CE%sT",null]],"Atlantic/Faroe":[["27.066666666666666","-","LMT","-1955750400000"],["0","-","WET","378604800000"],["0","EU","WE%sT",null]],"America/Danmarkshavn":[["74.66666666666667","-","LMT","-1686096000000"],["180","-","-03","323834400000"],["180","EU","-03/-02","851990400000"],["0","-","GMT",null]],"America/Scoresbysund":[["87.86666666666667","-","LMT","-1686096000000"],["120","-","-02","323834400000"],["120","C-Eur","-02/-01","354672000000"],["60","EU","-01/+00",null]],"America/Godthab":[["206.93333333333334","-","LMT","-1686096000000"],["180","-","-03","323834400000"],["180","EU","-03/-02",null]],"America/Thule":[["275.1333333333333","-","LMT","-1686096000000"],["240","Thule","A%sT",null]],"Europe/Tallinn":[["-99","-","LMT","-2808604800000"],["-99","-","TMT","-1638316800000"],["-60","C-Eur","CE%sT","-1593820800000"],["-99","-","TMT","-1535932800000"],["-120","-","EET","-927936000000"],["-180","-","MSK","-892944000000"],["-60","C-Eur","CE%sT","-797644800000"],["-180","Russia","MSK/MSD","606880800000"],["-120","1:00","EEST","622605600000"],["-120","C-Eur","EE%sT","906422400000"],["-120","EU","EE%sT","941342400000"],["-120","-","EET","1014249600000"],["-120","EU","EE%sT",null]],"Europe/Helsinki":[["-99.81666666666668","-","LMT","-2890252800000"],["-99.81666666666668","-","HMT","-1535932800000"],["-120","Finland","EE%sT","441676800000"],["-120","EU","EE%sT",null]],"Europe/Mariehamn":"Europe/Helsinki","Europe/Paris":[["-9.35","-","LMT","-2486678340000"],["-9.35","-","PMT","-1855958340000"],["0","France","WE%sT","-932432400000"],["-60","C-Eur","CE%sT","-800064000000"],["0","France","WE%sT","-766616400000"],["-60","France","CE%sT","252374400000"],["-60","EU","CE%sT",null]],"Europe/Berlin":[["-53.46666666666666","-","LMT","-2422051200000"],["-60","C-Eur","CE%sT","-776556000000"],["-60","SovietZone","CE%sT","-725932800000"],["-60","Germany","CE%sT","347068800000"],["-60","EU","CE%sT",null]],"Europe/Busingen":"Europe/Zurich","Europe/Gibraltar":[["21.4","-","LMT","-2821651200000"],["0","GB-Eire","%s","-401320800000"],["-60","-","CET","410140800000"],["-60","EU","CE%sT",null]],"Europe/Athens":[["-94.86666666666667","-","LMT","-2344636800000"],["-94.86666666666667","-","AMT","-1686095940000"],["-120","Greece","EE%sT","-904867200000"],["-60","Greece","CE%sT","-812419200000"],["-120","Greece","EE%sT","378604800000"],["-120","EU","EE%sT",null]],"Europe/Budapest":[["-76.33333333333333","-","LMT","-2500934400000"],["-60","C-Eur","CE%sT","-1609545600000"],["-60","Hungary","CE%sT","-906768000000"],["-60","C-Eur","CE%sT","-757468800000"],["-60","Hungary","CE%sT","338954400000"],["-60","EU","CE%sT",null]],"Atlantic/Reykjavik":[["88","-","LMT","-1925078400000"],["60","Iceland","-01/+00","-54774000000"],["0","-","GMT",null]],"Europe/Rome":[["-49.93333333333334","-","LMT","-3259094400000"],["-49.93333333333334","-","RMT","-2403562204000"],["-60","Italy","CE%sT","-830304000000"],["-60","C-Eur","CE%sT","-807148800000"],["-60","Italy","CE%sT","347068800000"],["-60","EU","CE%sT",null]],"Europe/Vatican":"Europe/Rome","Europe/San_Marino":"Europe/Rome","Europe/Riga":[["-96.56666666666668","-","LMT","-2808604800000"],["-96.56666666666668","-","RMT","-1632002400000"],["-96.56666666666668","1:00","LST","-1618693200000"],["-96.56666666666668","-","RMT","-1601676000000"],["-96.56666666666668","1:00","LST","-1597266000000"],["-96.56666666666668","-","RMT","-1377302400000"],["-120","-","EET","-928022400000"],["-180","-","MSK","-899510400000"],["-60","C-Eur","CE%sT","-795830400000"],["-180","Russia","MSK/MSD","604720800000"],["-120","1:00","EEST","620618400000"],["-120","Latvia","EE%sT","853804800000"],["-120","EU","EE%sT","951782400000"],["-120","-","EET","978393600000"],["-120","EU","EE%sT",null]],"Europe/Vaduz":"Europe/Zurich","Europe/Vilnius":[["-101.26666666666667","-","LMT","-2808604800000"],["-84","-","WMT","-1641081600000"],["-95.6","-","KMT","-1585094400000"],["-60","-","CET","-1561248000000"],["-120","-","EET","-1553558400000"],["-60","-","CET","-928195200000"],["-180","-","MSK","-900115200000"],["-60","C-Eur","CE%sT","-802137600000"],["-180","Russia","MSK/MSD","606880800000"],["-120","Russia","EE%sT","686109600000"],["-120","C-Eur","EE%sT","915062400000"],["-120","-","EET","891133200000"],["-60","EU","CE%sT","941331600000"],["-120","-","EET","1041379200000"],["-120","EU","EE%sT",null]],"Europe/Luxembourg":[["-24.6","-","LMT","-2069712000000"],["-60","Lux","CE%sT","-1612656000000"],["0","Lux","WE%sT","-1269813600000"],["0","Belgium","WE%sT","-935182800000"],["-60","C-Eur","WE%sT","-797979600000"],["-60","Belgium","CE%sT","252374400000"],["-60","EU","CE%sT",null]],"Europe/Malta":[["-58.06666666666666","-","LMT","-2403475200000"],["-60","Italy","CE%sT","102384000000"],["-60","Malta","CE%sT","378604800000"],["-60","EU","CE%sT",null]],"Europe/Chisinau":[["-115.33333333333333","-","LMT","-2808604800000"],["-115","-","CMT","-1637107200000"],["-104.4","-","BMT","-1213142400000"],["-120","Romania","EE%sT","-927158400000"],["-120","1:00","EEST","-898128000000"],["-60","C-Eur","CE%sT","-800150400000"],["-180","Russia","MSK/MSD","641959200000"],["-120","Russia","EE%sT","725760000000"],["-120","E-Eur","EE%sT","883526400000"],["-120","Moldova","EE%sT",null]],"Europe/Monaco":[["-29.53333333333333","-","LMT","-2486678400000"],["-9.35","-","PMT","-1855958400000"],["0","France","WE%sT","-766616400000"],["-60","France","CE%sT","252374400000"],["-60","EU","CE%sT",null]],"Europe/Amsterdam":[["-19.53333333333333","-","LMT","-4228761600000"],["-19.53333333333333","Neth","%s","-1025740800000"],["-20","Neth","+0020/+0120","-935020800000"],["-60","C-Eur","CE%sT","-781048800000"],["-60","Neth","CE%sT","252374400000"],["-60","EU","CE%sT",null]],"Europe/Oslo":[["-43","-","LMT","-2366755200000"],["-60","Norway","CE%sT","-927507600000"],["-60","C-Eur","CE%sT","-781048800000"],["-60","Norway","CE%sT","347068800000"],["-60","EU","CE%sT",null]],"Arctic/Longyearbyen":"Europe/Oslo","Europe/Warsaw":[["-84","-","LMT","-2808604800000"],["-84","-","WMT","-1717027200000"],["-60","C-Eur","CE%sT","-1618693200000"],["-120","Poland","EE%sT","-1501718400000"],["-60","Poland","CE%sT","-931730400000"],["-60","C-Eur","CE%sT","-796867200000"],["-60","Poland","CE%sT","252374400000"],["-60","W-Eur","CE%sT","599529600000"],["-60","EU","CE%sT",null]],"Europe/Lisbon":[["36.75","-","LMT","-2682374400000"],["36.75","-","LMT","-1830384000000"],["0","Port","WE%sT","-118274400000"],["-60","-","CET","212547600000"],["0","Port","WE%sT","433299600000"],["0","W-Eur","WE%sT","717555600000"],["-60","EU","CE%sT","828234000000"],["0","EU","WE%sT",null]],"Atlantic/Azores":[["102.66666666666667","-","LMT","-2682374400000"],["114.53333333333333","-","HMT","-1830384000000"],["120","Port","-02/-01","-873684000000"],["120","Port","+00","-864007200000"],["120","Port","-02/-01","-842839200000"],["120","Port","+00","-831348000000"],["120","Port","-02/-01","-810784800000"],["120","Port","+00","-799898400000"],["120","Port","-02/-01","-779335200000"],["120","Port","+00","-768448800000"],["120","Port","-02/-01","-118274400000"],["60","Port","-01/+00","433299600000"],["60","W-Eur","-01/+00","717555600000"],["0","EU","WE%sT","733280400000"],["60","EU","-01/+00",null]],"Atlantic/Madeira":[["67.6","-","LMT","-2682374400000"],["67.6","-","FMT","-1830384000000"],["60","Port","-01/+00","-873684000000"],["60","Port","+01","-864007200000"],["60","Port","-01/+00","-842839200000"],["60","Port","+01","-831348000000"],["60","Port","-01/+00","-810784800000"],["60","Port","+01","-799898400000"],["60","Port","-01/+00","-779335200000"],["60","Port","+01","-768448800000"],["60","Port","-01/+00","-118274400000"],["0","Port","WE%sT","433299600000"],["0","EU","WE%sT",null]],"Europe/Bucharest":[["-104.4","-","LMT","-2469398400000"],["-104.4","-","BMT","-1213142400000"],["-120","Romania","EE%sT","354679200000"],["-120","C-Eur","EE%sT","694137600000"],["-120","Romania","EE%sT","788832000000"],["-120","E-Eur","EE%sT","883526400000"],["-120","EU","EE%sT",null]],"Europe/Kaliningrad":[["-82","-","LMT","-2422051200000"],["-60","C-Eur","CE%sT","-757468800000"],["-120","Poland","CE%sT","-725932800000"],["-180","Russia","MSK/MSD","606880800000"],["-120","Russia","EE%sT","1301191200000"],["-180","-","+03","1414288800000"],["-120","-","EET",null]],"Europe/Moscow":[["-150.28333333333333","-","LMT","-2808604800000"],["-150.28333333333333","-","MMT","-1688256000000"],["-151.31666666666666","Russia","%s","-1593820800000"],["-180","Russia","%s","-1522713600000"],["-180","Russia","MSK/MSD","-1491177600000"],["-120","-","EET","-1247529600000"],["-180","Russia","MSK/MSD","670384800000"],["-120","Russia","EE%sT","695786400000"],["-180","Russia","MSK/MSD","1301191200000"],["-240","-","MSK","1414288800000"],["-180","-","MSK",null]],"Europe/Simferopol":[["-136.4","-","LMT","-2808604800000"],["-136","-","SMT","-1441152000000"],["-120","-","EET","-1247529600000"],["-180","-","MSK","-888883200000"],["-60","C-Eur","CE%sT","-811641600000"],["-180","Russia","MSK/MSD","662601600000"],["-180","-","MSK","646797600000"],["-120","-","EET","725760000000"],["-120","E-Eur","EE%sT","767750400000"],["-180","E-Eur","MSK/MSD","828230400000"],["-180","1:00","MSD","846385200000"],["-180","Russia","MSK/MSD","883526400000"],["-180","-","MSK","857178000000"],["-120","EU","EE%sT","1396144800000"],["-240","-","MSK","1414288800000"],["-180","-","MSK",null]],"Europe/Astrakhan":[["-192.2","-","LMT","-1441238400000"],["-180","-","+03","-1247529600000"],["-240","Russia","+04/+05","606880800000"],["-180","Russia","+03/+04","670384800000"],["-240","-","+04","701834400000"],["-180","Russia","+03/+04","1301191200000"],["-240","-","+04","1414288800000"],["-180","-","+03","1459044000000"],["-240","-","+04",null]],"Europe/Volgograd":[["-177.66666666666666","-","LMT","-1577750400000"],["-180","-","+03","-1247529600000"],["-240","-","+04","-256867200000"],["-240","Russia","+04/+05","575431200000"],["-180","Russia","+03/+04","670384800000"],["-240","-","+04","701834400000"],["-180","Russia","+03/+04","1301191200000"],["-240","-","+04","1414288800000"],["-180","-","+03",null]],"Europe/Saratov":[["-184.3","-","LMT","-1593820800000"],["-180","-","+03","-1247529600000"],["-240","Russia","+04/+05","575431200000"],["-180","Russia","+03/+04","670384800000"],["-240","-","+04","701834400000"],["-180","Russia","+03/+04","1301191200000"],["-240","-","+04","1414288800000"],["-180","-","+03","1480816800000"],["-240","-","+04",null]],"Europe/Kirov":[["-198.8","-","LMT","-1593820800000"],["-180","-","+03","-1247529600000"],["-240","Russia","+04/+05","606880800000"],["-180","Russia","+03/+04","670384800000"],["-240","-","+04","701834400000"],["-180","Russia","+03/+04","1301191200000"],["-240","-","+04","1414288800000"],["-180","-","+03",null]],"Europe/Samara":[["-200.33333333333334","-","LMT","-1593820800000"],["-180","-","+03","-1247529600000"],["-240","-","+04","-1102291200000"],["-240","Russia","+04/+05","606880800000"],["-180","Russia","+03/+04","670384800000"],["-120","Russia","+02/+03","686109600000"],["-180","-","+03","687927600000"],["-240","Russia","+04/+05","1269741600000"],["-180","Russia","+03/+04","1301191200000"],["-240","-","+04",null]],"Europe/Ulyanovsk":[["-193.6","-","LMT","-1593820800000"],["-180","-","+03","-1247529600000"],["-240","Russia","+04/+05","606880800000"],["-180","Russia","+03/+04","670384800000"],["-120","Russia","+02/+03","695786400000"],["-180","Russia","+03/+04","1301191200000"],["-240","-","+04","1414288800000"],["-180","-","+03","1459044000000"],["-240","-","+04",null]],"Asia/Yekaterinburg":[["-242.55","-","LMT","-1688256000000"],["-225.08333333333334","-","PMT","-1592596800000"],["-240","-","+04","-1247529600000"],["-300","Russia","+05/+06","670384800000"],["-240","Russia","+04/+05","695786400000"],["-300","Russia","+05/+06","1301191200000"],["-360","-","+06","1414288800000"],["-300","-","+05",null]],"Asia/Omsk":[["-293.5","-","LMT","-1582070400000"],["-300","-","+05","-1247529600000"],["-360","Russia","+06/+07","670384800000"],["-300","Russia","+05/+06","695786400000"],["-360","Russia","+06/+07","1301191200000"],["-420","-","+07","1414288800000"],["-360","-","+06",null]],"Asia/Barnaul":[["-335","-","LMT","-1579824000000"],["-360","-","+06","-1247529600000"],["-420","Russia","+07/+08","670384800000"],["-360","Russia","+06/+07","695786400000"],["-420","Russia","+07/+08","801619200000"],["-360","Russia","+06/+07","1301191200000"],["-420","-","+07","1414288800000"],["-360","-","+06","1459044000000"],["-420","-","+07",null]],"Asia/Novosibirsk":[["-331.6666666666667","-","LMT","-1579456800000"],["-360","-","+06","-1247529600000"],["-420","Russia","+07/+08","670384800000"],["-360","Russia","+06/+07","695786400000"],["-420","Russia","+07/+08","738115200000"],["-360","Russia","+06/+07","1301191200000"],["-420","-","+07","1414288800000"],["-360","-","+06","1469325600000"],["-420","-","+07",null]],"Asia/Tomsk":[["-339.85","-","LMT","-1578787200000"],["-360","-","+06","-1247529600000"],["-420","Russia","+07/+08","670384800000"],["-360","Russia","+06/+07","695786400000"],["-420","Russia","+07/+08","1020222000000"],["-360","Russia","+06/+07","1301191200000"],["-420","-","+07","1414288800000"],["-360","-","+06","1464487200000"],["-420","-","+07",null]],"Asia/Novokuznetsk":[["-348.8","-","LMT","-1441238400000"],["-360","-","+06","-1247529600000"],["-420","Russia","+07/+08","670384800000"],["-360","Russia","+06/+07","695786400000"],["-420","Russia","+07/+08","1269741600000"],["-360","Russia","+06/+07","1301191200000"],["-420","-","+07",null]],"Asia/Krasnoyarsk":[["-371.43333333333334","-","LMT","-1577491200000"],["-360","-","+06","-1247529600000"],["-420","Russia","+07/+08","670384800000"],["-360","Russia","+06/+07","695786400000"],["-420","Russia","+07/+08","1301191200000"],["-480","-","+08","1414288800000"],["-420","-","+07",null]],"Asia/Irkutsk":[["-417.0833333333333","-","LMT","-2808604800000"],["-417.0833333333333","-","IMT","-1575849600000"],["-420","-","+07","-1247529600000"],["-480","Russia","+08/+09","670384800000"],["-420","Russia","+07/+08","695786400000"],["-480","Russia","+08/+09","1301191200000"],["-540","-","+09","1414288800000"],["-480","-","+08",null]],"Asia/Chita":[["-453.8666666666667","-","LMT","-1579392000000"],["-480","-","+08","-1247529600000"],["-540","Russia","+09/+10","670384800000"],["-480","Russia","+08/+09","695786400000"],["-540","Russia","+09/+10","1301191200000"],["-600","-","+10","1414288800000"],["-480","-","+08","1459044000000"],["-540","-","+09",null]],"Asia/Yakutsk":[["-518.9666666666667","-","LMT","-1579392000000"],["-480","-","+08","-1247529600000"],["-540","Russia","+09/+10","670384800000"],["-480","Russia","+08/+09","695786400000"],["-540","Russia","+09/+10","1301191200000"],["-600","-","+10","1414288800000"],["-540","-","+09",null]],"Asia/Vladivostok":[["-527.5166666666667","-","LMT","-1487289600000"],["-540","-","+09","-1247529600000"],["-600","Russia","+10/+11","670384800000"],["-540","Russia","+09/+10","695786400000"],["-600","Russia","+10/+11","1301191200000"],["-660","-","+11","1414288800000"],["-600","-","+10",null]],"Asia/Khandyga":[["-542.2166666666666","-","LMT","-1579392000000"],["-480","-","+08","-1247529600000"],["-540","Russia","+09/+10","670384800000"],["-480","Russia","+08/+09","695786400000"],["-540","Russia","+09/+10","1104451200000"],["-600","Russia","+10/+11","1301191200000"],["-660","-","+11","1315872000000"],["-600","-","+10","1414288800000"],["-540","-","+09",null]],"Asia/Sakhalin":[["-570.8","-","LMT","-2031004800000"],["-540","-","+09","-768528000000"],["-660","Russia","+11/+12","670384800000"],["-600","Russia","+10/+11","695786400000"],["-660","Russia","+11/+12","857181600000"],["-600","Russia","+10/+11","1301191200000"],["-660","-","+11","1414288800000"],["-600","-","+10","1459044000000"],["-660","-","+11",null]],"Asia/Magadan":[["-603.2","-","LMT","-1441152000000"],["-600","-","+10","-1247529600000"],["-660","Russia","+11/+12","670384800000"],["-600","Russia","+10/+11","695786400000"],["-660","Russia","+11/+12","1301191200000"],["-720","-","+12","1414288800000"],["-600","-","+10","1461463200000"],["-660","-","+11",null]],"Asia/Srednekolymsk":[["-614.8666666666667","-","LMT","-1441152000000"],["-600","-","+10","-1247529600000"],["-660","Russia","+11/+12","670384800000"],["-600","Russia","+10/+11","695786400000"],["-660","Russia","+11/+12","1301191200000"],["-720","-","+12","1414288800000"],["-660","-","+11",null]],"Asia/Ust-Nera":[["-572.9","-","LMT","-1579392000000"],["-480","-","+08","-1247529600000"],["-540","Russia","+09/+10","354931200000"],["-660","Russia","+11/+12","670384800000"],["-600","Russia","+10/+11","695786400000"],["-660","Russia","+11/+12","1301191200000"],["-720","-","+12","1315872000000"],["-660","-","+11","1414288800000"],["-600","-","+10",null]],"Asia/Kamchatka":[["-634.6","-","LMT","-1487721600000"],["-660","-","+11","-1247529600000"],["-720","Russia","+12/+13","670384800000"],["-660","Russia","+11/+12","695786400000"],["-720","Russia","+12/+13","1269741600000"],["-660","Russia","+11/+12","1301191200000"],["-720","-","+12",null]],"Asia/Anadyr":[["-709.9333333333334","-","LMT","-1441152000000"],["-720","-","+12","-1247529600000"],["-780","Russia","+13/+14","386467200000"],["-720","Russia","+12/+13","670384800000"],["-660","Russia","+11/+12","695786400000"],["-720","Russia","+12/+13","1269741600000"],["-660","Russia","+11/+12","1301191200000"],["-720","-","+12",null]],"Europe/Belgrade":[["-82","-","LMT","-2682374400000"],["-60","-","CET","-905821200000"],["-60","C-Eur","CE%sT","-757468800000"],["-60","-","CET","-777938400000"],["-60","1:00","CEST","-766620000000"],["-60","-","CET","407203200000"],["-60","EU","CE%sT",null]],"Europe/Ljubljana":"Europe/Belgrade","Europe/Podgorica":"Europe/Belgrade","Europe/Sarajevo":"Europe/Belgrade","Europe/Skopje":"Europe/Belgrade","Europe/Zagreb":"Europe/Belgrade","Europe/Bratislava":"Europe/Prague","Europe/Madrid":[["14.733333333333334","-","LMT","-2177453684000"],["0","Spain","WE%sT","-940208400000"],["-60","Spain","CE%sT","315446400000"],["-60","EU","CE%sT",null]],"Africa/Ceuta":[["21.26666666666667","-","LMT","-2177454076000"],["0","-","WET","-1630112400000"],["0","1:00","WEST","-1616806800000"],["0","-","WET","-1420156800000"],["0","Spain","WE%sT","-1262390400000"],["0","SpainAfrica","WE%sT","448243200000"],["-60","-","CET","536371200000"],["-60","EU","CE%sT",null]],"Atlantic/Canary":[["61.6","-","LMT","-1509667200000"],["60","-","-01","-733878000000"],["0","-","WET","323827200000"],["0","1:00","WEST","338950800000"],["0","EU","WE%sT",null]],"Europe/Stockholm":[["-72.2","-","LMT","-2871676800000"],["-60.233333333333334","-","SET","-2208988800000"],["-60","-","CET","-1692493200000"],["-60","1:00","CEST","-1680476400000"],["-60","-","CET","347068800000"],["-60","EU","CE%sT",null]],"Europe/Zurich":[["-34.13333333333333","-","LMT","-3675196800000"],["-29.76666666666667","-","BMT","-2385244800000"],["-60","Swiss","CE%sT","378604800000"],["-60","EU","CE%sT",null]],"Europe/Istanbul":[["-115.86666666666667","-","LMT","-2808604800000"],["-116.93333333333332","-","IMT","-1869868800000"],["-120","Turkey","EE%sT","277257600000"],["-180","Turkey","+03/+04","482803200000"],["-120","Turkey","EE%sT","1199059200000"],["-120","EU","EE%sT","1301187600000"],["-120","-","EET","1301274000000"],["-120","EU","EE%sT","1396141200000"],["-120","-","EET","1396227600000"],["-120","EU","EE%sT","1445734800000"],["-120","1:00","EEST","1446944400000"],["-120","EU","EE%sT","1473206400000"],["-180","-","+03",null]],"Asia/Istanbul":"Europe/Istanbul","Europe/Kiev":[["-122.06666666666668","-","LMT","-2808604800000"],["-122.06666666666668","-","KMT","-1441152000000"],["-120","-","EET","-1247529600000"],["-180","-","MSK","-892512000000"],["-60","C-Eur","CE%sT","-825379200000"],["-180","Russia","MSK/MSD","646797600000"],["-120","1:00","EEST","686113200000"],["-120","E-Eur","EE%sT","820368000000"],["-120","EU","EE%sT",null]],"Europe/Uzhgorod":[["-89.2","-","LMT","-2500934400000"],["-60","-","CET","-915235200000"],["-60","C-Eur","CE%sT","-796867200000"],["-60","1:00","CEST","-794707200000"],["-60","-","CET","-773452800000"],["-180","Russia","MSK/MSD","662601600000"],["-180","-","MSK","646797600000"],["-60","-","CET","670388400000"],["-120","-","EET","725760000000"],["-120","E-Eur","EE%sT","820368000000"],["-120","EU","EE%sT",null]],"Europe/Zaporozhye":[["-140.66666666666666","-","LMT","-2808604800000"],["-140","-","+0220","-1441152000000"],["-120","-","EET","-1247529600000"],["-180","-","MSK","-894758400000"],["-60","C-Eur","CE%sT","-826416000000"],["-180","Russia","MSK/MSD","670384800000"],["-120","E-Eur","EE%sT","820368000000"],["-120","EU","EE%sT",null]],"Factory":[["0","-","-00",null]],"EST":[["300","-","EST",null]],"MST":[["420","-","MST",null]],"HST":[["600","-","HST",null]],"EST5EDT":[["300","US","E%sT",null]],"CST6CDT":[["360","US","C%sT",null]],"MST7MDT":[["420","US","M%sT",null]],"PST8PDT":[["480","US","P%sT",null]],"America/New_York":[["296.0333333333333","-","LMT","-2717668562000"],["300","US","E%sT","-1546387200000"],["300","NYC","E%sT","-852163200000"],["300","US","E%sT","-725932800000"],["300","NYC","E%sT","-63244800000"],["300","US","E%sT",null]],"America/Chicago":[["350.6","-","LMT","-2717668236000"],["360","US","C%sT","-1546387200000"],["360","Chicago","C%sT","-1067810400000"],["300","-","EST","-1045432800000"],["360","Chicago","C%sT","-852163200000"],["360","US","C%sT","-725932800000"],["360","Chicago","C%sT","-63244800000"],["360","US","C%sT",null]],"America/North_Dakota/Center":[["405.2","-","LMT","-2717667912000"],["420","US","M%sT","719978400000"],["360","US","C%sT",null]],"America/North_Dakota/New_Salem":[["405.65","-","LMT","-2717667939000"],["420","US","M%sT","1067133600000"],["360","US","C%sT",null]],"America/North_Dakota/Beulah":[["407.1166666666667","-","LMT","-2717668027000"],["420","US","M%sT","1289095200000"],["360","US","C%sT",null]],"America/Denver":[["419.93333333333334","-","LMT","-2717668796000"],["420","US","M%sT","-1546387200000"],["420","Denver","M%sT","-852163200000"],["420","US","M%sT","-725932800000"],["420","Denver","M%sT","-63244800000"],["420","US","M%sT",null]],"America/Los_Angeles":[["472.9666666666667","-","LMT","-2717668378000"],["480","US","P%sT","-725932800000"],["480","CA","P%sT","-63244800000"],["480","US","P%sT",null]],"America/Juneau":[["-902.3166666666666","-","LMT","-3225169588000"],["537.6833333333334","-","LMT","-2188987200000"],["480","-","PST","-852163200000"],["480","US","P%sT","-725932800000"],["480","-","PST","-86400000"],["480","US","P%sT","325648800000"],["540","US","Y%sT","341373600000"],["480","US","P%sT","436327200000"],["540","US","Y%sT","438998400000"],["540","US","AK%sT",null]],"America/Sitka":[["-898.7833333333334","-","LMT","-3225169800000"],["541.2166666666666","-","LMT","-2188987200000"],["480","-","PST","-852163200000"],["480","US","P%sT","-725932800000"],["480","-","PST","-86400000"],["480","US","P%sT","436327200000"],["540","US","Y%sT","438998400000"],["540","US","AK%sT",null]],"America/Metlakatla":[["-913.7","-","LMT","-3225168905000"],["526.3","-","LMT","-2188987200000"],["480","-","PST","-852163200000"],["480","US","P%sT","-725932800000"],["480","-","PST","-86400000"],["480","US","P%sT","436327200000"],["480","-","PST","1446343200000"],["540","US","AK%sT",null]],"America/Yakutat":[["-881.0833333333334","-","LMT","-3225170862000"],["558.9166666666666","-","LMT","-2188987200000"],["540","-","YST","-852163200000"],["540","US","Y%sT","-725932800000"],["540","-","YST","-86400000"],["540","US","Y%sT","438998400000"],["540","US","AK%sT",null]],"America/Anchorage":[["-840.4","-","LMT","-3225173303000"],["599.6","-","LMT","-2188987200000"],["600","-","AST","-852163200000"],["600","US","A%sT","-86918400000"],["600","-","AHST","-86400000"],["600","US","AH%sT","436327200000"],["540","US","Y%sT","438998400000"],["540","US","AK%sT",null]],"America/Nome":[["-778.3666666666667","-","LMT","-3225177025000"],["661.6333333333333","-","LMT","-2188987200000"],["660","-","NST","-852163200000"],["660","US","N%sT","-725932800000"],["660","-","NST","-86918400000"],["660","-","BST","-86400000"],["660","US","B%sT","436327200000"],["540","US","Y%sT","438998400000"],["540","US","AK%sT",null]],"America/Adak":[["-733.3666666666667","-","LMT","-3225179725000"],["706.6333333333333","-","LMT","-2188987200000"],["660","-","NST","-852163200000"],["660","US","N%sT","-725932800000"],["660","-","NST","-86918400000"],["660","-","BST","-86400000"],["660","US","B%sT","436327200000"],["600","US","AH%sT","438998400000"],["600","US","H%sT",null]],"Pacific/Honolulu":[["631.4333333333334","-","LMT","-2334139200000"],["630","-","HST","-1157320800000"],["630","1:00","HDT","-1155470400000"],["630","-","HST","-880236000000"],["630","1:00","HDT","-765410400000"],["630","-","HST","-712188000000"],["600","-","HST",null]],"America/Phoenix":[["448.3","-","LMT","-2717670498000"],["420","US","M%sT","-820540740000"],["420","-","MST","-812678340000"],["420","US","M%sT","-796867140000"],["420","-","MST","-63244800000"],["420","US","M%sT","-56246400000"],["420","-","MST",null]],"America/Boise":[["464.81666666666666","-","LMT","-2717667889000"],["480","US","P%sT","-1471816800000"],["420","US","M%sT","157680000000"],["420","-","MST","129088800000"],["420","US","M%sT",null]],"America/Indiana/Indianapolis":[["344.6333333333333","-","LMT","-2717667878000"],["360","US","C%sT","-1546387200000"],["360","Indianapolis","C%sT","-852163200000"],["360","US","C%sT","-725932800000"],["360","Indianapolis","C%sT","-463615200000"],["300","-","EST","-386805600000"],["360","-","CST","-368661600000"],["300","-","EST","-86400000"],["300","US","E%sT","62985600000"],["300","-","EST","1167523200000"],["300","US","E%sT",null]],"America/Indiana/Marengo":[["345.3833333333333","-","LMT","-2717667923000"],["360","US","C%sT","-568166400000"],["360","Marengo","C%sT","-273708000000"],["300","-","EST","-86400000"],["300","US","E%sT","126669600000"],["360","1:00","CDT","152071200000"],["300","US","E%sT","220838400000"],["300","-","EST","1167523200000"],["300","US","E%sT",null]],"America/Indiana/Vincennes":[["350.1166666666667","-","LMT","-2717668207000"],["360","US","C%sT","-725932800000"],["360","Vincennes","C%sT","-179359200000"],["300","-","EST","-86400000"],["300","US","E%sT","62985600000"],["300","-","EST","1143943200000"],["360","US","C%sT","1194141600000"],["300","US","E%sT",null]],"America/Indiana/Tell_City":[["347.05","-","LMT","-2717668023000"],["360","US","C%sT","-725932800000"],["360","Perry","C%sT","-179359200000"],["300","-","EST","-86400000"],["300","US","E%sT","62985600000"],["300","-","EST","1143943200000"],["360","US","C%sT",null]],"America/Indiana/Petersburg":[["349.1166666666667","-","LMT","-2717668147000"],["360","US","C%sT","-441936000000"],["360","Pike","C%sT","-147909600000"],["300","-","EST","-100130400000"],["360","US","C%sT","247024800000"],["300","-","EST","1143943200000"],["360","US","C%sT","1194141600000"],["300","US","E%sT",null]],"America/Indiana/Knox":[["346.5","-","LMT","-2717667990000"],["360","US","C%sT","-694396800000"],["360","Starke","C%sT","-242258400000"],["300","-","EST","-195084000000"],["360","US","C%sT","688528800000"],["300","-","EST","1143943200000"],["360","US","C%sT",null]],"America/Indiana/Winamac":[["346.4166666666667","-","LMT","-2717667985000"],["360","US","C%sT","-725932800000"],["360","Pulaski","C%sT","-273708000000"],["300","-","EST","-86400000"],["300","US","E%sT","62985600000"],["300","-","EST","1143943200000"],["360","US","C%sT","1173578400000"],["300","US","E%sT",null]],"America/Indiana/Vevay":[["340.2666666666667","-","LMT","-2717667616000"],["360","US","C%sT","-495064800000"],["300","-","EST","-86400000"],["300","US","E%sT","126144000000"],["300","-","EST","1167523200000"],["300","US","E%sT",null]],"America/Kentucky/Louisville":[["343.0333333333333","-","LMT","-2717667782000"],["360","US","C%sT","-1514851200000"],["360","Louisville","C%sT","-852163200000"],["360","US","C%sT","-725932800000"],["360","Louisville","C%sT","-266450400000"],["300","-","EST","-31622400000"],["300","US","E%sT","126669600000"],["360","1:00","CDT","152071200000"],["300","US","E%sT",null]],"America/Kentucky/Monticello":[["339.4","-","LMT","-2717667564000"],["360","US","C%sT","-725932800000"],["360","-","CST","-31622400000"],["360","US","C%sT","972784800000"],["300","US","E%sT",null]],"America/Detroit":[["332.18333333333334","-","LMT","-2019772800000"],["360","-","CST","-1724104800000"],["300","-","EST","-852163200000"],["300","US","E%sT","-725932800000"],["300","Detroit","E%sT","126144000000"],["300","US","E%sT","189216000000"],["300","-","EST","167796000000"],["300","US","E%sT",null]],"America/Menominee":[["350.45","-","LMT","-2659780800000"],["360","US","C%sT","-725932800000"],["360","Menominee","C%sT","-21506400000"],["300","-","EST","104896800000"],["360","US","C%sT",null]],"America/St_Johns":[["210.86666666666665","-","LMT","-2682374400000"],["210.86666666666665","StJohns","N%sT","-1609545600000"],["210.86666666666665","Canada","N%sT","-1578009600000"],["210.86666666666665","StJohns","N%sT","-1096934400000"],["210","StJohns","N%sT","-872380800000"],["210","Canada","N%sT","-725932800000"],["210","StJohns","N%sT","1320105600000"],["210","Canada","N%sT",null]],"America/Goose_Bay":[["241.66666666666666","-","LMT","-2682374400000"],["210.86666666666665","-","NST","-1609545600000"],["210.86666666666665","Canada","N%sT","-1578009600000"],["210.86666666666665","-","NST","-1096934400000"],["210","-","NST","-1041465600000"],["210","StJohns","N%sT","-872380800000"],["210","Canada","N%sT","-725932800000"],["210","StJohns","N%sT","-119916000000"],["240","StJohns","A%sT","1320105600000"],["240","Canada","A%sT",null]],"America/Halifax":[["254.4","-","LMT","-2131660800000"],["240","Halifax","A%sT","-1609545600000"],["240","Canada","A%sT","-1578009600000"],["240","Halifax","A%sT","-880236000000"],["240","Canada","A%sT","-725932800000"],["240","Halifax","A%sT","157680000000"],["240","Canada","A%sT",null]],"America/Glace_Bay":[["239.8","-","LMT","-2131660800000"],["240","Canada","A%sT","-505008000000"],["240","Halifax","A%sT","-473472000000"],["240","-","AST","94608000000"],["240","Halifax","A%sT","157680000000"],["240","Canada","A%sT",null]],"America/Moncton":[["259.1333333333333","-","LMT","-2715897600000"],["300","-","EST","-2131660800000"],["240","Canada","A%sT","-1136160000000"],["240","Moncton","A%sT","-852163200000"],["240","Canada","A%sT","-725932800000"],["240","Moncton","A%sT","126144000000"],["240","Canada","A%sT","757296000000"],["240","Moncton","A%sT","1199059200000"],["240","Canada","A%sT",null]],"America/Blanc-Sablon":[["228.46666666666667","-","LMT","-2682374400000"],["240","Canada","A%sT","31449600000"],["240","-","AST",null]],"America/Toronto":[["317.5333333333333","-","LMT","-2335305600000"],["300","Canada","E%sT","-1578009600000"],["300","Toronto","E%sT","-880236000000"],["300","Canada","E%sT","-725932800000"],["300","Toronto","E%sT","157680000000"],["300","Canada","E%sT",null]],"America/Thunder_Bay":[["357","-","LMT","-2335305600000"],["360","-","CST","-1862006400000"],["300","-","EST","-852163200000"],["300","Canada","E%sT","31449600000"],["300","Toronto","E%sT","126144000000"],["300","-","EST","157680000000"],["300","Canada","E%sT",null]],"America/Nipigon":[["353.06666666666666","-","LMT","-2335305600000"],["300","Canada","E%sT","-923270400000"],["300","1:00","EDT","-880236000000"],["300","Canada","E%sT",null]],"America/Rainy_River":[["378.2666666666667","-","LMT","-2335305600000"],["360","Canada","C%sT","-923270400000"],["360","1:00","CDT","-880236000000"],["360","Canada","C%sT",null]],"America/Atikokan":[["366.4666666666667","-","LMT","-2335305600000"],["360","Canada","C%sT","-923270400000"],["360","1:00","CDT","-880236000000"],["360","Canada","C%sT","-765410400000"],["300","-","EST",null]],"America/Winnipeg":[["388.6","-","LMT","-2602281600000"],["360","Winn","C%sT","1167523200000"],["360","Canada","C%sT",null]],"America/Regina":[["418.6","-","LMT","-2030227200000"],["420","Regina","M%sT","-307749600000"],["360","-","CST",null]],"America/Swift_Current":[["431.3333333333333","-","LMT","-2030227200000"],["420","Canada","M%sT","-749599200000"],["420","Regina","M%sT","-599702400000"],["420","Swift","M%sT","70941600000"],["360","-","CST",null]],"America/Edmonton":[["453.8666666666667","-","LMT","-1998691200000"],["420","Edm","M%sT","567907200000"],["420","Canada","M%sT",null]],"America/Vancouver":[["492.4666666666667","-","LMT","-2682374400000"],["480","Vanc","P%sT","567907200000"],["480","Canada","P%sT",null]],"America/Dawson_Creek":[["480.93333333333334","-","LMT","-2682374400000"],["480","Canada","P%sT","-694396800000"],["480","Vanc","P%sT","83988000000"],["420","-","MST",null]],"America/Fort_Nelson":[["490.7833333333333","-","LMT","-2682374400000"],["480","Vanc","P%sT","-725932800000"],["480","-","PST","-694396800000"],["480","Vanc","P%sT","567907200000"],["480","Canada","P%sT","1425780000000"],["420","-","MST",null]],"America/Creston":[["466.06666666666666","-","LMT","-2682374400000"],["420","-","MST","-1680480000000"],["480","-","PST","-1627862400000"],["420","-","MST",null]],"America/Pangnirtung":[["0","-","-00","-1514851200000"],["240","NT_YK","A%sT","796701600000"],["300","Canada","E%sT","941335200000"],["360","Canada","C%sT","972784800000"],["300","Canada","E%sT",null]],"America/Iqaluit":[["0","-","-00","-865296000000"],["300","NT_YK","E%sT","941335200000"],["360","Canada","C%sT","972784800000"],["300","Canada","E%sT",null]],"America/Resolute":[["0","-","-00","-704937600000"],["360","NT_YK","C%sT","972784800000"],["300","-","EST","986094000000"],["360","Canada","C%sT","1162087200000"],["300","-","EST","1173582000000"],["360","Canada","C%sT",null]],"America/Rankin_Inlet":[["0","-","-00","-378777600000"],["360","NT_YK","C%sT","972784800000"],["300","-","EST","986094000000"],["360","Canada","C%sT",null]],"America/Cambridge_Bay":[["0","-","-00","-1546387200000"],["420","NT_YK","M%sT","941335200000"],["360","Canada","C%sT","972784800000"],["300","-","EST","973382400000"],["360","-","CST","986094000000"],["420","Canada","M%sT",null]],"America/Yellowknife":[["0","-","-00","-1073088000000"],["420","NT_YK","M%sT","347068800000"],["420","Canada","M%sT",null]],"America/Inuvik":[["0","-","-00","-505008000000"],["480","NT_YK","P%sT","291780000000"],["420","NT_YK","M%sT","347068800000"],["420","Canada","M%sT",null]],"America/Whitehorse":[["540.2","-","LMT","-2189030400000"],["540","NT_YK","Y%sT","-81993600000"],["480","NT_YK","P%sT","347068800000"],["480","Canada","P%sT",null]],"America/Dawson":[["557.6666666666666","-","LMT","-2189030400000"],["540","NT_YK","Y%sT","120614400000"],["480","NT_YK","P%sT","347068800000"],["480","Canada","P%sT",null]],"America/Cancun":[["347.06666666666666","-","LMT","-1514764024000"],["360","-","CST","377913600000"],["300","Mexico","E%sT","902023200000"],["360","Mexico","C%sT","1422756000000"],["300","-","EST",null]],"America/Merida":[["358.4666666666667","-","LMT","-1514764708000"],["360","-","CST","377913600000"],["300","-","EST","407635200000"],["360","Mexico","C%sT",null]],"America/Matamoros":[["400","-","LMT","-1514767200000"],["360","-","CST","599529600000"],["360","US","C%sT","631065600000"],["360","Mexico","C%sT","1293753600000"],["360","US","C%sT",null]],"America/Monterrey":[["401.2666666666667","-","LMT","-1514767276000"],["360","-","CST","599529600000"],["360","US","C%sT","631065600000"],["360","Mexico","C%sT",null]],"America/Mexico_City":[["396.6","-","LMT","-1514763396000"],["420","-","MST","-1343091600000"],["360","-","CST","-1234828800000"],["420","-","MST","-1220317200000"],["360","-","CST","-1207180800000"],["420","-","MST","-1191369600000"],["360","Mexico","C%sT","1001815200000"],["360","-","CST","1014163200000"],["360","Mexico","C%sT",null]],"America/Ojinaga":[["417.6666666666667","-","LMT","-1514764660000"],["420","-","MST","-1343091600000"],["360","-","CST","-1234828800000"],["420","-","MST","-1220317200000"],["360","-","CST","-1207180800000"],["420","-","MST","-1191369600000"],["360","-","CST","851990400000"],["360","Mexico","C%sT","915062400000"],["360","-","CST","891399600000"],["420","Mexico","M%sT","1293753600000"],["420","US","M%sT",null]],"America/Chihuahua":[["424.3333333333333","-","LMT","-1514765060000"],["420","-","MST","-1343091600000"],["360","-","CST","-1234828800000"],["420","-","MST","-1220317200000"],["360","-","CST","-1207180800000"],["420","-","MST","-1191369600000"],["360","-","CST","851990400000"],["360","Mexico","C%sT","915062400000"],["360","-","CST","891399600000"],["420","Mexico","M%sT",null]],"America/Hermosillo":[["443.8666666666667","-","LMT","-1514766232000"],["420","-","MST","-1343091600000"],["360","-","CST","-1234828800000"],["420","-","MST","-1220317200000"],["360","-","CST","-1207180800000"],["420","-","MST","-1191369600000"],["360","-","CST","-873849600000"],["420","-","MST","-661564800000"],["480","-","PST","31449600000"],["420","Mexico","M%sT","946598400000"],["420","-","MST",null]],"America/Mazatlan":[["425.6666666666667","-","LMT","-1514765140000"],["420","-","MST","-1343091600000"],["360","-","CST","-1234828800000"],["420","-","MST","-1220317200000"],["360","-","CST","-1207180800000"],["420","-","MST","-1191369600000"],["360","-","CST","-873849600000"],["420","-","MST","-661564800000"],["480","-","PST","31449600000"],["420","Mexico","M%sT",null]],"America/Bahia_Banderas":[["421","-","LMT","-1514764860000"],["420","-","MST","-1343091600000"],["360","-","CST","-1234828800000"],["420","-","MST","-1220317200000"],["360","-","CST","-1207180800000"],["420","-","MST","-1191369600000"],["360","-","CST","-873849600000"],["420","-","MST","-661564800000"],["480","-","PST","31449600000"],["420","Mexico","M%sT","1270346400000"],["360","Mexico","C%sT",null]],"America/Tijuana":[["468.06666666666666","-","LMT","-1514764084000"],["420","-","MST","-1420156800000"],["480","-","PST","-1343091600000"],["420","-","MST","-1234828800000"],["480","-","PST","-1222992000000"],["480","1:00","PDT","-1207267200000"],["480","-","PST","-873849600000"],["480","1:00","PWT","-769395600000"],["480","1:00","PPT","-761702400000"],["480","-","PST","-686102400000"],["480","1:00","PDT","-661564800000"],["480","-","PST","-473472000000"],["480","CA","P%sT","-252547200000"],["480","-","PST","220838400000"],["480","US","P%sT","851990400000"],["480","Mexico","P%sT","1009756800000"],["480","US","P%sT","1014163200000"],["480","Mexico","P%sT","1293753600000"],["480","US","P%sT",null]],"America/Nassau":[["309.5","-","LMT","-1825113600000"],["300","Bahamas","E%sT","220838400000"],["300","US","E%sT",null]],"America/Barbados":[["238.48333333333335","-","LMT","-1420156800000"],["238.48333333333335","-","BMT","-1167696000000"],["240","Barb","A%sT",null]],"America/Belize":[["352.8","-","LMT","-1822521600000"],["360","Belize","%s",null]],"Atlantic/Bermuda":[["259.3","-","LMT","-1262296800000"],["240","-","AST","136346400000"],["240","Canada","A%sT","220838400000"],["240","US","A%sT",null]],"America/Costa_Rica":[["336.2166666666667","-","LMT","-2493072000000"],["336.2166666666667","-","SJMT","-1545091200000"],["360","CR","C%sT",null]],"America/Havana":[["329.4666666666667","-","LMT","-2493072000000"],["329.6","-","HMT","-1402833600000"],["300","Cuba","C%sT",null]],"America/Santo_Domingo":[["279.6","-","LMT","-2493072000000"],["280","-","SDMT","-1159790400000"],["300","DR","%s","152064000000"],["240","-","AST","972784800000"],["300","US","E%sT","975805200000"],["240","-","AST",null]],"America/El_Salvador":[["356.8","-","LMT","-1514851200000"],["360","Salv","C%sT",null]],"America/Guatemala":[["362.06666666666666","-","LMT","-1617062400000"],["360","Guat","C%sT",null]],"America/Port-au-Prince":[["289.3333333333333","-","LMT","-2493072000000"],["289","-","PPMT","-1670500800000"],["300","Haiti","E%sT",null]],"America/Tegucigalpa":[["348.8666666666667","-","LMT","-1538524800000"],["360","Hond","C%sT",null]],"America/Jamaica":[["307.18333333333334","-","LMT","-2493072000000"],["307.18333333333334","-","KMT","-1827705600000"],["300","-","EST","157680000000"],["300","US","E%sT","473299200000"],["300","-","EST",null]],"America/Martinique":[["244.33333333333334","-","LMT","-2493072000000"],["244.33333333333334","-","FFMT","-1851552000000"],["240","-","AST","323827200000"],["240","1:00","ADT","338947200000"],["240","-","AST",null]],"America/Managua":[["345.1333333333333","-","LMT","-2493072000000"],["345.2","-","MMT","-1121126400000"],["360","-","CST","105062400000"],["300","-","EST","161740800000"],["360","Nic","C%sT","694238400000"],["300","-","EST","717292800000"],["360","-","CST","757296000000"],["300","-","EST","883526400000"],["360","Nic","C%sT",null]],"America/Panama":[["318.1333333333333","-","LMT","-2493072000000"],["319.6","-","CMT","-1946937600000"],["300","-","EST",null]],"America/Cayman":"America/Panama","America/Puerto_Rico":[["264.4166666666667","-","LMT","-2233051200000"],["240","-","AST","-873072000000"],["240","US","A%sT","-725932800000"],["240","-","AST",null]],"America/Miquelon":[["224.66666666666666","-","LMT","-1850342400000"],["240","-","AST","325987200000"],["180","-","-03","567907200000"],["180","Canada","-03/-02",null]],"America/Grand_Turk":[["284.5333333333333","-","LMT","-2493072000000"],["307.18333333333334","-","KMT","-1827705600000"],["300","-","EST","315446400000"],["300","US","E%sT","1446343200000"],["240","-","AST","1520737200000"],["300","US","E%sT",null]],"US/Pacific-New":"America/Los_Angeles","America/Argentina/Buenos_Aires":[["233.8","-","LMT","-2372112000000"],["256.8","-","CMT","-1567468800000"],["240","-","-04","-1233446400000"],["240","Arg","-04/-03","-7603200000"],["180","Arg","-03/-02","938908800000"],["240","Arg","-04/-03","952041600000"],["180","Arg","-03/-02",null]],"America/Argentina/Cordoba":[["256.8","-","LMT","-2372112000000"],["256.8","-","CMT","-1567468800000"],["240","-","-04","-1233446400000"],["240","Arg","-04/-03","-7603200000"],["180","Arg","-03/-02","667958400000"],["240","-","-04","687916800000"],["180","Arg","-03/-02","938908800000"],["240","Arg","-04/-03","952041600000"],["180","Arg","-03/-02",null]],"America/Argentina/Salta":[["261.66666666666663","-","LMT","-2372112000000"],["256.8","-","CMT","-1567468800000"],["240","-","-04","-1233446400000"],["240","Arg","-04/-03","-7603200000"],["180","Arg","-03/-02","667958400000"],["240","-","-04","687916800000"],["180","Arg","-03/-02","938908800000"],["240","Arg","-04/-03","952041600000"],["180","Arg","-03/-02","1224288000000"],["180","-","-03",null]],"America/Argentina/Tucuman":[["260.8666666666667","-","LMT","-2372112000000"],["256.8","-","CMT","-1567468800000"],["240","-","-04","-1233446400000"],["240","Arg","-04/-03","-7603200000"],["180","Arg","-03/-02","667958400000"],["240","-","-04","687916800000"],["180","Arg","-03/-02","938908800000"],["240","Arg","-04/-03","952041600000"],["180","-","-03","1086048000000"],["240","-","-04","1087084800000"],["180","Arg","-03/-02",null]],"America/Argentina/La_Rioja":[["267.4","-","LMT","-2372112000000"],["256.8","-","CMT","-1567468800000"],["240","-","-04","-1233446400000"],["240","Arg","-04/-03","-7603200000"],["180","Arg","-03/-02","667785600000"],["240","-","-04","673574400000"],["180","Arg","-03/-02","938908800000"],["240","Arg","-04/-03","952041600000"],["180","-","-03","1086048000000"],["240","-","-04","1087689600000"],["180","Arg","-03/-02","1224288000000"],["180","-","-03",null]],"America/Argentina/San_Juan":[["274.06666666666666","-","LMT","-2372112000000"],["256.8","-","CMT","-1567468800000"],["240","-","-04","-1233446400000"],["240","Arg","-04/-03","-7603200000"],["180","Arg","-03/-02","667785600000"],["240","-","-04","673574400000"],["180","Arg","-03/-02","938908800000"],["240","Arg","-04/-03","952041600000"],["180","-","-03","1085961600000"],["240","-","-04","1090713600000"],["180","Arg","-03/-02","1224288000000"],["180","-","-03",null]],"America/Argentina/Jujuy":[["261.2","-","LMT","-2372112000000"],["256.8","-","CMT","-1567468800000"],["240","-","-04","-1233446400000"],["240","Arg","-04/-03","-7603200000"],["180","Arg","-03/-02","636508800000"],["240","-","-04","657072000000"],["240","1:00","-03","669168000000"],["240","-","-04","686707200000"],["180","1:00","-02","725760000000"],["180","Arg","-03/-02","938908800000"],["240","Arg","-04/-03","952041600000"],["180","Arg","-03/-02","1224288000000"],["180","-","-03",null]],"America/Argentina/Catamarca":[["263.1333333333333","-","LMT","-2372112000000"],["256.8","-","CMT","-1567468800000"],["240","-","-04","-1233446400000"],["240","Arg","-04/-03","-7603200000"],["180","Arg","-03/-02","667958400000"],["240","-","-04","687916800000"],["180","Arg","-03/-02","938908800000"],["240","Arg","-04/-03","952041600000"],["180","-","-03","1086048000000"],["240","-","-04","1087689600000"],["180","Arg","-03/-02","1224288000000"],["180","-","-03",null]],"America/Argentina/Mendoza":[["275.2666666666667","-","LMT","-2372112000000"],["256.8","-","CMT","-1567468800000"],["240","-","-04","-1233446400000"],["240","Arg","-04/-03","-7603200000"],["180","Arg","-03/-02","636508800000"],["240","-","-04","655948800000"],["240","1:00","-03","667785600000"],["240","-","-04","687484800000"],["240","1:00","-03","699408000000"],["240","-","-04","719366400000"],["180","Arg","-03/-02","938908800000"],["240","Arg","-04/-03","952041600000"],["180","-","-03","1085270400000"],["240","-","-04","1096156800000"],["180","Arg","-03/-02","1224288000000"],["180","-","-03",null]],"America/Argentina/San_Luis":[["265.4","-","LMT","-2372112000000"],["256.8","-","CMT","-1567468800000"],["240","-","-04","-1233446400000"],["240","Arg","-04/-03","-7603200000"],["180","Arg","-03/-02","662601600000"],["180","1:00","-02","637372800000"],["240","-","-04","655948800000"],["240","1:00","-03","667785600000"],["240","-","-04","675734400000"],["180","-","-03","938908800000"],["240","1:00","-03","952041600000"],["180","-","-03","1085961600000"],["240","-","-04","1090713600000"],["180","Arg","-03/-02","1200873600000"],["240","SanLuis","-04/-03","1255219200000"],["180","-","-03",null]],"America/Argentina/Rio_Gallegos":[["276.8666666666667","-","LMT","-2372112000000"],["256.8","-","CMT","-1567468800000"],["240","-","-04","-1233446400000"],["240","Arg","-04/-03","-7603200000"],["180","Arg","-03/-02","938908800000"],["240","Arg","-04/-03","952041600000"],["180","-","-03","1086048000000"],["240","-","-04","1087689600000"],["180","Arg","-03/-02","1224288000000"],["180","-","-03",null]],"America/Argentina/Ushuaia":[["273.2","-","LMT","-2372112000000"],["256.8","-","CMT","-1567468800000"],["240","-","-04","-1233446400000"],["240","Arg","-04/-03","-7603200000"],["180","Arg","-03/-02","938908800000"],["240","Arg","-04/-03","952041600000"],["180","-","-03","1085875200000"],["240","-","-04","1087689600000"],["180","Arg","-03/-02","1224288000000"],["180","-","-03",null]],"America/Aruba":"America/Curacao","America/La_Paz":[["272.6","-","LMT","-2493072000000"],["272.6","-","CMT","-1205971200000"],["272.6","1:00","BST","-1192320000000"],["240","-","-04",null]],"America/Noronha":[["129.66666666666669","-","LMT","-1735776000000"],["120","Brazil","-02/-01","653529600000"],["120","-","-02","938649600000"],["120","Brazil","-02/-01","971568000000"],["120","-","-02","1000339200000"],["120","Brazil","-02/-01","1033430400000"],["120","-","-02",null]],"America/Belem":[["193.93333333333334","-","LMT","-1735776000000"],["180","Brazil","-03/-02","590025600000"],["180","-","-03",null]],"America/Santarem":[["218.8","-","LMT","-1735776000000"],["240","Brazil","-04/-03","590025600000"],["240","-","-04","1214265600000"],["180","-","-03",null]],"America/Fortaleza":[["154","-","LMT","-1735776000000"],["180","Brazil","-03/-02","653529600000"],["180","-","-03","938649600000"],["180","Brazil","-03/-02","972172800000"],["180","-","-03","1000339200000"],["180","Brazil","-03/-02","1033430400000"],["180","-","-03",null]],"America/Recife":[["139.6","-","LMT","-1735776000000"],["180","Brazil","-03/-02","653529600000"],["180","-","-03","938649600000"],["180","Brazil","-03/-02","971568000000"],["180","-","-03","1000339200000"],["180","Brazil","-03/-02","1033430400000"],["180","-","-03",null]],"America/Araguaina":[["192.8","-","LMT","-1735776000000"],["180","Brazil","-03/-02","653529600000"],["180","-","-03","811036800000"],["180","Brazil","-03/-02","1064361600000"],["180","-","-03","1350777600000"],["180","Brazil","-03/-02","1377993600000"],["180","-","-03",null]],"America/Maceio":[["142.86666666666665","-","LMT","-1735776000000"],["180","Brazil","-03/-02","653529600000"],["180","-","-03","813542400000"],["180","Brazil","-03/-02","841795200000"],["180","-","-03","938649600000"],["180","Brazil","-03/-02","972172800000"],["180","-","-03","1000339200000"],["180","Brazil","-03/-02","1033430400000"],["180","-","-03",null]],"America/Bahia":[["154.06666666666666","-","LMT","-1735776000000"],["180","Brazil","-03/-02","1064361600000"],["180","-","-03","1318723200000"],["180","Brazil","-03/-02","1350777600000"],["180","-","-03",null]],"America/Sao_Paulo":[["186.46666666666667","-","LMT","-1735776000000"],["180","Brazil","-03/-02","-195436800000"],["180","1:00","-02","-157852800000"],["180","Brazil","-03/-02",null]],"America/Campo_Grande":[["218.46666666666667","-","LMT","-1735776000000"],["240","Brazil","-04/-03",null]],"America/Cuiaba":[["224.33333333333334","-","LMT","-1735776000000"],["240","Brazil","-04/-03","1064361600000"],["240","-","-04","1096588800000"],["240","Brazil","-04/-03",null]],"America/Porto_Velho":[["255.6","-","LMT","-1735776000000"],["240","Brazil","-04/-03","590025600000"],["240","-","-04",null]],"America/Boa_Vista":[["242.66666666666666","-","LMT","-1735776000000"],["240","Brazil","-04/-03","590025600000"],["240","-","-04","938649600000"],["240","Brazil","-04/-03","971568000000"],["240","-","-04",null]],"America/Manaus":[["240.06666666666666","-","LMT","-1735776000000"],["240","Brazil","-04/-03","590025600000"],["240","-","-04","749174400000"],["240","Brazil","-04/-03","780192000000"],["240","-","-04",null]],"America/Eirunepe":[["279.4666666666667","-","LMT","-1735776000000"],["300","Brazil","-05/-04","590025600000"],["300","-","-05","749174400000"],["300","Brazil","-05/-04","780192000000"],["300","-","-05","1214265600000"],["240","-","-04","1384041600000"],["300","-","-05",null]],"America/Rio_Branco":[["271.2","-","LMT","-1735776000000"],["300","Brazil","-05/-04","590025600000"],["300","-","-05","1214265600000"],["240","-","-04","1384041600000"],["300","-","-05",null]],"America/Santiago":[["282.7666666666667","-","LMT","-2493072000000"],["282.7666666666667","-","SMT","-1892678400000"],["300","-","-05","-1688428800000"],["282.7666666666667","-","SMT","-1619222400000"],["240","-","-04","-1593820800000"],["282.7666666666667","-","SMT","-1336003200000"],["300","Chile","-05/-04","-1178150400000"],["240","-","-04","-870566400000"],["300","-","-05","-865296000000"],["240","-","-04","-740534400000"],["240","1:00","-03","-736387200000"],["240","-","-04","-718070400000"],["300","-","-05","-713667600000"],["240","Chile","-04/-03",null]],"America/Punta_Arenas":[["283.6666666666667","-","LMT","-2493072000000"],["282.7666666666667","-","SMT","-1892678400000"],["300","-","-05","-1688428800000"],["282.7666666666667","-","SMT","-1619222400000"],["240","-","-04","-1593820800000"],["282.7666666666667","-","SMT","-1336003200000"],["300","Chile","-05/-04","-1178150400000"],["240","-","-04","-870566400000"],["300","-","-05","-865296000000"],["240","-","-04","-718070400000"],["300","-","-05","-713667600000"],["240","Chile","-04/-03","1480809600000"],["180","-","-03",null]],"Pacific/Easter":[["437.4666666666667","-","LMT","-2493072000000"],["437.4666666666667","-","EMT","-1178150400000"],["420","Chile","-07/-06","384922800000"],["360","Chile","-06/-05",null]],"Antarctica/Palmer":[["0","-","-00","-126316800000"],["240","Arg","-04/-03","-7603200000"],["180","Arg","-03/-02","389059200000"],["240","Chile","-04/-03","1480809600000"],["180","-","-03",null]],"America/Bogota":[["296.2666666666667","-","LMT","-2707689600000"],["296.2666666666667","-","BMT","-1739059200000"],["300","CO","-05/-04",null]],"America/Curacao":[["275.7833333333333","-","LMT","-1826755200000"],["270","-","-0430","-126316800000"],["240","-","AST",null]],"America/Lower_Princes":"America/Curacao","America/Kralendijk":"America/Curacao","America/Guayaquil":[["319.3333333333333","-","LMT","-2493072000000"],["314","-","QMT","-1199318400000"],["300","Ecuador","-05/-04",null]],"Pacific/Galapagos":[["358.4","-","LMT","-1199318400000"],["300","-","-05","536371200000"],["360","Ecuador","-06/-05",null]],"Atlantic/Stanley":[["231.4","-","LMT","-2493072000000"],["231.4","-","SMT","-1824249600000"],["240","Falk","-04/-03","420595200000"],["180","Falk","-03/-02","495590400000"],["240","Falk","-04/-03","1283652000000"],["180","-","-03",null]],"America/Cayenne":[["209.33333333333334","-","LMT","-1846281600000"],["240","-","-04","-71107200000"],["180","-","-03",null]],"America/Guyana":[["232.66666666666666","-","LMT","-1730592000000"],["225","-","-0345","175996800000"],["180","-","-03","694137600000"],["240","-","-04",null]],"America/Asuncion":[["230.66666666666666","-","LMT","-2493072000000"],["230.66666666666666","-","AMT","-1206403200000"],["240","-","-04","86745600000"],["180","-","-03","134006400000"],["240","Para","-04/-03",null]],"America/Lima":[["308.2","-","LMT","-2493072000000"],["308.6","-","LMT","-1938556800000"],["300","Peru","-05/-04",null]],"Atlantic/South_Georgia":[["146.13333333333335","-","LMT","-2493072000000"],["120","-","-02",null]],"America/Paramaribo":[["220.66666666666666","-","LMT","-1830470400000"],["220.86666666666665","-","PMT","-1073088000000"],["220.6","-","PMT","-765331200000"],["210","-","-0330","465436800000"],["180","-","-03",null]],"America/Port_of_Spain":[["246.06666666666666","-","LMT","-1825113600000"],["240","-","AST",null]],"America/Anguilla":"America/Port_of_Spain","America/Antigua":"America/Port_of_Spain","America/Dominica":"America/Port_of_Spain","America/Grenada":"America/Port_of_Spain","America/Guadeloupe":"America/Port_of_Spain","America/Marigot":"America/Port_of_Spain","America/Montserrat":"America/Port_of_Spain","America/St_Barthelemy":"America/Port_of_Spain","America/St_Kitts":"America/Port_of_Spain","America/St_Lucia":"America/Port_of_Spain","America/St_Thomas":"America/Port_of_Spain","America/St_Vincent":"America/Port_of_Spain","America/Tortola":"America/Port_of_Spain","America/Montevideo":[["224.73333333333335","-","LMT","-2256681600000"],["224.73333333333335","-","MMT","-1567468800000"],["210","Uruguay","-0330/-03","-853632000000"],["180","Uruguay","-03/-02","-31622400000"],["180","Uruguay","-03/-0230","62985600000"],["180","Uruguay","-03/-02","157680000000"],["180","Uruguay","-03/-0230","156902400000"],["180","Uruguay","-03/-02",null]],"America/Caracas":[["267.7333333333333","-","LMT","-2493072000000"],["267.6666666666667","-","CMT","-1826755200000"],["270","-","-0430","-157766400000"],["240","-","-04","1197169200000"],["270","-","-0430","1462069800000"],["240","-","-04",null]]},"rules":{"Algeria":[["1916","only","-","Jun","14",["23","0","0","s"],"60","S"],["1916","1919","-","Oct","Sun>=1",["23","0","0","s"],"0","-"],["1917","only","-","Mar","24",["23","0","0","s"],"60","S"],["1918","only","-","Mar","9",["23","0","0","s"],"60","S"],["1919","only","-","Mar","1",["23","0","0","s"],"60","S"],["1920","only","-","Feb","14",["23","0","0","s"],"60","S"],["1920","only","-","Oct","23",["23","0","0","s"],"0","-"],["1921","only","-","Mar","14",["23","0","0","s"],"60","S"],["1921","only","-","Jun","21",["23","0","0","s"],"0","-"],["1939","only","-","Sep","11",["23","0","0","s"],"60","S"],["1939","only","-","Nov","19",["1","0","0",null],"0","-"],["1944","1945","-","Apr","Mon>=1",["2","0","0",null],"60","S"],["1944","only","-","Oct","8",["2","0","0",null],"0","-"],["1945","only","-","Sep","16",["1","0","0",null],"0","-"],["1971","only","-","Apr","25",["23","0","0","s"],"60","S"],["1971","only","-","Sep","26",["23","0","0","s"],"0","-"],["1977","only","-","May","6",["0","0","0",null],"60","S"],["1977","only","-","Oct","21",["0","0","0",null],"0","-"],["1978","only","-","Mar","24",["1","0","0",null],"60","S"],["1978","only","-","Sep","22",["3","0","0",null],"0","-"],["1980","only","-","Apr","25",["0","0","0",null],"60","S"],["1980","only","-","Oct","31",["2","0","0",null],"0","-"]],"Egypt":[["1940","only","-","Jul","15",["0","0","0",null],"60","S"],["1940","only","-","Oct","1",["0","0","0",null],"0","-"],["1941","only","-","Apr","15",["0","0","0",null],"60","S"],["1941","only","-","Sep","16",["0","0","0",null],"0","-"],["1942","1944","-","Apr","1",["0","0","0",null],"60","S"],["1942","only","-","Oct","27",["0","0","0",null],"0","-"],["1943","1945","-","Nov","1",["0","0","0",null],"0","-"],["1945","only","-","Apr","16",["0","0","0",null],"60","S"],["1957","only","-","May","10",["0","0","0",null],"60","S"],["1957","1958","-","Oct","1",["0","0","0",null],"0","-"],["1958","only","-","May","1",["0","0","0",null],"60","S"],["1959","1981","-","May","1",["1","0","0",null],"60","S"],["1959","1965","-","Sep","30",["3","0","0",null],"0","-"],["1966","1994","-","Oct","1",["3","0","0",null],"0","-"],["1982","only","-","Jul","25",["1","0","0",null],"60","S"],["1983","only","-","Jul","12",["1","0","0",null],"60","S"],["1984","1988","-","May","1",["1","0","0",null],"60","S"],["1989","only","-","May","6",["1","0","0",null],"60","S"],["1990","1994","-","May","1",["1","0","0",null],"60","S"],["1995","2010","-","Apr","lastFri",["0","0","0","s"],"60","S"],["1995","2005","-","Sep","lastThu",["24","0","0",null],"0","-"],["2006","only","-","Sep","21",["24","0","0",null],"0","-"],["2007","only","-","Sep","Thu>=1",["24","0","0",null],"0","-"],["2008","only","-","Aug","lastThu",["24","0","0",null],"0","-"],["2009","only","-","Aug","20",["24","0","0",null],"0","-"],["2010","only","-","Aug","10",["24","0","0",null],"0","-"],["2010","only","-","Sep","9",["24","0","0",null],"60","S"],["2010","only","-","Sep","lastThu",["24","0","0",null],"0","-"],["2014","only","-","May","15",["24","0","0",null],"60","S"],["2014","only","-","Jun","26",["24","0","0",null],"0","-"],["2014","only","-","Jul","31",["24","0","0",null],"60","S"],["2014","only","-","Sep","lastThu",["24","0","0",null],"0","-"]],"Ghana":[["1920","1942","-","Sep","1",["0","0","0",null],"20","GHST"],["1920","1942","-","Dec","31",["0","0","0",null],"0","GMT"]],"Libya":[["1951","only","-","Oct","14",["2","0","0",null],"60","S"],["1952","only","-","Jan","1",["0","0","0",null],"0","-"],["1953","only","-","Oct","9",["2","0","0",null],"60","S"],["1954","only","-","Jan","1",["0","0","0",null],"0","-"],["1955","only","-","Sep","30",["0","0","0",null],"60","S"],["1956","only","-","Jan","1",["0","0","0",null],"0","-"],["1982","1984","-","Apr","1",["0","0","0",null],"60","S"],["1982","1985","-","Oct","1",["0","0","0",null],"0","-"],["1985","only","-","Apr","6",["0","0","0",null],"60","S"],["1986","only","-","Apr","4",["0","0","0",null],"60","S"],["1986","only","-","Oct","3",["0","0","0",null],"0","-"],["1987","1989","-","Apr","1",["0","0","0",null],"60","S"],["1987","1989","-","Oct","1",["0","0","0",null],"0","-"],["1997","only","-","Apr","4",["0","0","0",null],"60","S"],["1997","only","-","Oct","4",["0","0","0",null],"0","-"],["2013","only","-","Mar","lastFri",["1","0","0",null],"60","S"],["2013","only","-","Oct","lastFri",["2","0","0",null],"0","-"]],"Mauritius":[["1982","only","-","Oct","10",["0","0","0",null],"60","S"],["1983","only","-","Mar","21",["0","0","0",null],"0","-"],["2008","only","-","Oct","lastSun",["2","0","0",null],"60","S"],["2009","only","-","Mar","lastSun",["2","0","0",null],"0","-"]],"Morocco":[["1939","only","-","Sep","12",["0","0","0",null],"60","S"],["1939","only","-","Nov","19",["0","0","0",null],"0","-"],["1940","only","-","Feb","25",["0","0","0",null],"60","S"],["1945","only","-","Nov","18",["0","0","0",null],"0","-"],["1950","only","-","Jun","11",["0","0","0",null],"60","S"],["1950","only","-","Oct","29",["0","0","0",null],"0","-"],["1967","only","-","Jun","3",["12","0","0",null],"60","S"],["1967","only","-","Oct","1",["0","0","0",null],"0","-"],["1974","only","-","Jun","24",["0","0","0",null],"60","S"],["1974","only","-","Sep","1",["0","0","0",null],"0","-"],["1976","1977","-","May","1",["0","0","0",null],"60","S"],["1976","only","-","Aug","1",["0","0","0",null],"0","-"],["1977","only","-","Sep","28",["0","0","0",null],"0","-"],["1978","only","-","Jun","1",["0","0","0",null],"60","S"],["1978","only","-","Aug","4",["0","0","0",null],"0","-"],["2008","only","-","Jun","1",["0","0","0",null],"60","S"],["2008","only","-","Sep","1",["0","0","0",null],"0","-"],["2009","only","-","Jun","1",["0","0","0",null],"60","S"],["2009","only","-","Aug","21",["0","0","0",null],"0","-"],["2010","only","-","May","2",["0","0","0",null],"60","S"],["2010","only","-","Aug","8",["0","0","0",null],"0","-"],["2011","only","-","Apr","3",["0","0","0",null],"60","S"],["2011","only","-","Jul","31",["0","0","0",null],"0","-"],["2012","2013","-","Apr","lastSun",["2","0","0",null],"60","S"],["2012","only","-","Jul","20",["3","0","0",null],"0","-"],["2012","only","-","Aug","20",["2","0","0",null],"60","S"],["2012","only","-","Sep","30",["3","0","0",null],"0","-"],["2013","only","-","Jul","7",["3","0","0",null],"0","-"],["2013","only","-","Aug","10",["2","0","0",null],"60","S"],["2013","max","-","Oct","lastSun",["3","0","0",null],"0","-"],["2014","2021","-","Mar","lastSun",["2","0","0",null],"60","S"],["2014","only","-","Jun","28",["3","0","0",null],"0","-"],["2014","only","-","Aug","2",["2","0","0",null],"60","S"],["2015","only","-","Jun","14",["3","0","0",null],"0","-"],["2015","only","-","Jul","19",["2","0","0",null],"60","S"],["2016","only","-","Jun","5",["3","0","0",null],"0","-"],["2016","only","-","Jul","10",["2","0","0",null],"60","S"],["2017","only","-","May","21",["3","0","0",null],"0","-"],["2017","only","-","Jul","2",["2","0","0",null],"60","S"],["2018","only","-","May","13",["3","0","0",null],"0","-"],["2018","only","-","Jun","17",["2","0","0",null],"60","S"],["2019","only","-","May","5",["3","0","0",null],"0","-"],["2019","only","-","Jun","9",["2","0","0",null],"60","S"],["2020","only","-","Apr","19",["3","0","0",null],"0","-"],["2020","only","-","May","24",["2","0","0",null],"60","S"],["2021","only","-","Apr","11",["3","0","0",null],"0","-"],["2021","only","-","May","16",["2","0","0",null],"60","S"],["2022","only","-","May","8",["2","0","0",null],"60","S"],["2023","only","-","Apr","23",["2","0","0",null],"60","S"],["2024","only","-","Apr","14",["2","0","0",null],"60","S"],["2025","only","-","Apr","6",["2","0","0",null],"60","S"],["2026","max","-","Mar","lastSun",["2","0","0",null],"60","S"],["2036","only","-","Oct","19",["3","0","0",null],"0","-"],["2037","only","-","Oct","4",["3","0","0",null],"0","-"]],"Namibia":[["1994","only","-","Mar","21",["0","0","0",null],"0","-"],["1994","2016","-","Sep","Sun>=1",["2","0","0",null],"60","S"],["1995","2017","-","Apr","Sun>=1",["2","0","0",null],"0","-"]],"SA":[["1942","1943","-","Sep","Sun>=15",["2","0","0",null],"60","-"],["1943","1944","-","Mar","Sun>=15",["2","0","0",null],"0","-"]],"Sudan":[["1970","only","-","May","1",["0","0","0",null],"60","S"],["1970","1985","-","Oct","15",["0","0","0",null],"0","-"],["1971","only","-","Apr","30",["0","0","0",null],"60","S"],["1972","1985","-","Apr","lastSun",["0","0","0",null],"60","S"]],"Tunisia":[["1939","only","-","Apr","15",["23","0","0","s"],"60","S"],["1939","only","-","Nov","18",["23","0","0","s"],"0","-"],["1940","only","-","Feb","25",["23","0","0","s"],"60","S"],["1941","only","-","Oct","6",["0","0","0",null],"0","-"],["1942","only","-","Mar","9",["0","0","0",null],"60","S"],["1942","only","-","Nov","2",["3","0","0",null],"0","-"],["1943","only","-","Mar","29",["2","0","0",null],"60","S"],["1943","only","-","Apr","17",["2","0","0",null],"0","-"],["1943","only","-","Apr","25",["2","0","0",null],"60","S"],["1943","only","-","Oct","4",["2","0","0",null],"0","-"],["1944","1945","-","Apr","Mon>=1",["2","0","0",null],"60","S"],["1944","only","-","Oct","8",["0","0","0",null],"0","-"],["1945","only","-","Sep","16",["0","0","0",null],"0","-"],["1977","only","-","Apr","30",["0","0","0","s"],"60","S"],["1977","only","-","Sep","24",["0","0","0","s"],"0","-"],["1978","only","-","May","1",["0","0","0","s"],"60","S"],["1978","only","-","Oct","1",["0","0","0","s"],"0","-"],["1988","only","-","Jun","1",["0","0","0","s"],"60","S"],["1988","1990","-","Sep","lastSun",["0","0","0","s"],"0","-"],["1989","only","-","Mar","26",["0","0","0","s"],"60","S"],["1990","only","-","May","1",["0","0","0","s"],"60","S"],["2005","only","-","May","1",["0","0","0","s"],"60","S"],["2005","only","-","Sep","30",["1","0","0","s"],"0","-"],["2006","2008","-","Mar","lastSun",["2","0","0","s"],"60","S"],["2006","2008","-","Oct","lastSun",["2","0","0","s"],"0","-"]],"Troll":[["2005","max","-","Mar","lastSun",["1","0","0","u"],"120","+02"],["2004","max","-","Oct","lastSun",["1","0","0","u"],"0","+00"]],"EUAsia":[["1981","max","-","Mar","lastSun",["1","0","0","u"],"60","S"],["1979","1995","-","Sep","lastSun",["1","0","0","u"],"0","-"],["1996","max","-","Oct","lastSun",["1","0","0","u"],"0","-"]],"E-EurAsia":[["1981","max","-","Mar","lastSun",["0","0","0",null],"60","S"],["1979","1995","-","Sep","lastSun",["0","0","0",null],"0","-"],["1996","max","-","Oct","lastSun",["0","0","0",null],"0","-"]],"RussiaAsia":[["1981","1984","-","Apr","1",["0","0","0",null],"60","S"],["1981","1983","-","Oct","1",["0","0","0",null],"0","-"],["1984","1995","-","Sep","lastSun",["2","0","0","s"],"0","-"],["1985","2010","-","Mar","lastSun",["2","0","0","s"],"60","S"],["1996","2010","-","Oct","lastSun",["2","0","0","s"],"0","-"]],"Armenia":[["2011","only","-","Mar","lastSun",["2","0","0","s"],"60","S"],["2011","only","-","Oct","lastSun",["2","0","0","s"],"0","-"]],"Azer":[["1997","2015","-","Mar","lastSun",["4","0","0",null],"60","S"],["1997","2015","-","Oct","lastSun",["5","0","0",null],"0","-"]],"Dhaka":[["2009","only","-","Jun","19",["23","0","0",null],"60","S"],["2009","only","-","Dec","31",["24","0","0",null],"0","-"]],"Shang":[["1940","only","-","Jun","3",["0","0","0",null],"60","D"],["1940","1941","-","Oct","1",["0","0","0",null],"0","S"],["1941","only","-","Mar","16",["0","0","0",null],"60","D"]],"PRC":[["1986","only","-","May","4",["0","0","0",null],"60","D"],["1986","1991","-","Sep","Sun>=11",["0","0","0",null],"0","S"],["1987","1991","-","Apr","Sun>=10",["0","0","0",null],"60","D"]],"HK":[["1941","only","-","Apr","1",["3","30","0",null],"60","S"],["1941","only","-","Sep","30",["3","30","0",null],"0","-"],["1946","only","-","Apr","20",["3","30","0",null],"60","S"],["1946","only","-","Dec","1",["3","30","0",null],"0","-"],["1947","only","-","Apr","13",["3","30","0",null],"60","S"],["1947","only","-","Dec","30",["3","30","0",null],"0","-"],["1948","only","-","May","2",["3","30","0",null],"60","S"],["1948","1951","-","Oct","lastSun",["3","30","0",null],"0","-"],["1952","only","-","Oct","25",["3","30","0",null],"0","-"],["1949","1953","-","Apr","Sun>=1",["3","30","0",null],"60","S"],["1953","only","-","Nov","1",["3","30","0",null],"0","-"],["1954","1964","-","Mar","Sun>=18",["3","30","0",null],"60","S"],["1954","only","-","Oct","31",["3","30","0",null],"0","-"],["1955","1964","-","Nov","Sun>=1",["3","30","0",null],"0","-"],["1965","1976","-","Apr","Sun>=16",["3","30","0",null],"60","S"],["1965","1976","-","Oct","Sun>=16",["3","30","0",null],"0","-"],["1973","only","-","Dec","30",["3","30","0",null],"60","S"],["1979","only","-","May","Sun>=8",["3","30","0",null],"60","S"],["1979","only","-","Oct","Sun>=16",["3","30","0",null],"0","-"]],"Taiwan":[["1946","only","-","May","15",["0","0","0",null],"60","D"],["1946","only","-","Oct","1",["0","0","0",null],"0","S"],["1947","only","-","Apr","15",["0","0","0",null],"60","D"],["1947","only","-","Nov","1",["0","0","0",null],"0","S"],["1948","1951","-","May","1",["0","0","0",null],"60","D"],["1948","1951","-","Oct","1",["0","0","0",null],"0","S"],["1952","only","-","Mar","1",["0","0","0",null],"60","D"],["1952","1954","-","Nov","1",["0","0","0",null],"0","S"],["1953","1959","-","Apr","1",["0","0","0",null],"60","D"],["1955","1961","-","Oct","1",["0","0","0",null],"0","S"],["1960","1961","-","Jun","1",["0","0","0",null],"60","D"],["1974","1975","-","Apr","1",["0","0","0",null],"60","D"],["1974","1975","-","Oct","1",["0","0","0",null],"0","S"],["1979","only","-","Jul","1",["0","0","0",null],"60","D"],["1979","only","-","Oct","1",["0","0","0",null],"0","S"]],"Macau":[["1961","1962","-","Mar","Sun>=16",["3","30","0",null],"60","D"],["1961","1964","-","Nov","Sun>=1",["3","30","0",null],"0","S"],["1963","only","-","Mar","Sun>=16",["0","0","0",null],"60","D"],["1964","only","-","Mar","Sun>=16",["3","30","0",null],"60","D"],["1965","only","-","Mar","Sun>=16",["0","0","0",null],"60","D"],["1965","only","-","Oct","31",["0","0","0",null],"0","S"],["1966","1971","-","Apr","Sun>=16",["3","30","0",null],"60","D"],["1966","1971","-","Oct","Sun>=16",["3","30","0",null],"0","S"],["1972","1974","-","Apr","Sun>=15",["0","0","0",null],"60","D"],["1972","1973","-","Oct","Sun>=15",["0","0","0",null],"0","S"],["1974","1977","-","Oct","Sun>=15",["3","30","0",null],"0","S"],["1975","1977","-","Apr","Sun>=15",["3","30","0",null],"60","D"],["1978","1980","-","Apr","Sun>=15",["0","0","0",null],"60","D"],["1978","1980","-","Oct","Sun>=15",["0","0","0",null],"0","S"]],"Cyprus":[["1975","only","-","Apr","13",["0","0","0",null],"60","S"],["1975","only","-","Oct","12",["0","0","0",null],"0","-"],["1976","only","-","May","15",["0","0","0",null],"60","S"],["1976","only","-","Oct","11",["0","0","0",null],"0","-"],["1977","1980","-","Apr","Sun>=1",["0","0","0",null],"60","S"],["1977","only","-","Sep","25",["0","0","0",null],"0","-"],["1978","only","-","Oct","2",["0","0","0",null],"0","-"],["1979","1997","-","Sep","lastSun",["0","0","0",null],"0","-"],["1981","1998","-","Mar","lastSun",["0","0","0",null],"60","S"]],"Iran":[["1978","1980","-","Mar","21",["0","0","0",null],"60","D"],["1978","only","-","Oct","21",["0","0","0",null],"0","S"],["1979","only","-","Sep","19",["0","0","0",null],"0","S"],["1980","only","-","Sep","23",["0","0","0",null],"0","S"],["1991","only","-","May","3",["0","0","0",null],"60","D"],["1992","1995","-","Mar","22",["0","0","0",null],"60","D"],["1991","1995","-","Sep","22",["0","0","0",null],"0","S"],["1996","only","-","Mar","21",["0","0","0",null],"60","D"],["1996","only","-","Sep","21",["0","0","0",null],"0","S"],["1997","1999","-","Mar","22",["0","0","0",null],"60","D"],["1997","1999","-","Sep","22",["0","0","0",null],"0","S"],["2000","only","-","Mar","21",["0","0","0",null],"60","D"],["2000","only","-","Sep","21",["0","0","0",null],"0","S"],["2001","2003","-","Mar","22",["0","0","0",null],"60","D"],["2001","2003","-","Sep","22",["0","0","0",null],"0","S"],["2004","only","-","Mar","21",["0","0","0",null],"60","D"],["2004","only","-","Sep","21",["0","0","0",null],"0","S"],["2005","only","-","Mar","22",["0","0","0",null],"60","D"],["2005","only","-","Sep","22",["0","0","0",null],"0","S"],["2008","only","-","Mar","21",["0","0","0",null],"60","D"],["2008","only","-","Sep","21",["0","0","0",null],"0","S"],["2009","2011","-","Mar","22",["0","0","0",null],"60","D"],["2009","2011","-","Sep","22",["0","0","0",null],"0","S"],["2012","only","-","Mar","21",["0","0","0",null],"60","D"],["2012","only","-","Sep","21",["0","0","0",null],"0","S"],["2013","2015","-","Mar","22",["0","0","0",null],"60","D"],["2013","2015","-","Sep","22",["0","0","0",null],"0","S"],["2016","only","-","Mar","21",["0","0","0",null],"60","D"],["2016","only","-","Sep","21",["0","0","0",null],"0","S"],["2017","2019","-","Mar","22",["0","0","0",null],"60","D"],["2017","2019","-","Sep","22",["0","0","0",null],"0","S"],["2020","only","-","Mar","21",["0","0","0",null],"60","D"],["2020","only","-","Sep","21",["0","0","0",null],"0","S"],["2021","2023","-","Mar","22",["0","0","0",null],"60","D"],["2021","2023","-","Sep","22",["0","0","0",null],"0","S"],["2024","only","-","Mar","21",["0","0","0",null],"60","D"],["2024","only","-","Sep","21",["0","0","0",null],"0","S"],["2025","2027","-","Mar","22",["0","0","0",null],"60","D"],["2025","2027","-","Sep","22",["0","0","0",null],"0","S"],["2028","2029","-","Mar","21",["0","0","0",null],"60","D"],["2028","2029","-","Sep","21",["0","0","0",null],"0","S"],["2030","2031","-","Mar","22",["0","0","0",null],"60","D"],["2030","2031","-","Sep","22",["0","0","0",null],"0","S"],["2032","2033","-","Mar","21",["0","0","0",null],"60","D"],["2032","2033","-","Sep","21",["0","0","0",null],"0","S"],["2034","2035","-","Mar","22",["0","0","0",null],"60","D"],["2034","2035","-","Sep","22",["0","0","0",null],"0","S"],["2036","max","-","Mar","21",["0","0","0",null],"60","D"],["2036","max","-","Sep","21",["0","0","0",null],"0","S"]],"Iraq":[["1982","only","-","May","1",["0","0","0",null],"60","D"],["1982","1984","-","Oct","1",["0","0","0",null],"0","S"],["1983","only","-","Mar","31",["0","0","0",null],"60","D"],["1984","1985","-","Apr","1",["0","0","0",null],"60","D"],["1985","1990","-","Sep","lastSun",["1","0","0","s"],"0","S"],["1986","1990","-","Mar","lastSun",["1","0","0","s"],"60","D"],["1991","2007","-","Apr","1",["3","0","0","s"],"60","D"],["1991","2007","-","Oct","1",["3","0","0","s"],"0","S"]],"Zion":[["1940","only","-","Jun","1",["0","0","0",null],"60","D"],["1942","1944","-","Nov","1",["0","0","0",null],"0","S"],["1943","only","-","Apr","1",["2","0","0",null],"60","D"],["1944","only","-","Apr","1",["0","0","0",null],"60","D"],["1945","only","-","Apr","16",["0","0","0",null],"60","D"],["1945","only","-","Nov","1",["2","0","0",null],"0","S"],["1946","only","-","Apr","16",["2","0","0",null],"60","D"],["1946","only","-","Nov","1",["0","0","0",null],"0","S"],["1948","only","-","May","23",["0","0","0",null],"120","DD"],["1948","only","-","Sep","1",["0","0","0",null],"60","D"],["1948","1949","-","Nov","1",["2","0","0",null],"0","S"],["1949","only","-","May","1",["0","0","0",null],"60","D"],["1950","only","-","Apr","16",["0","0","0",null],"60","D"],["1950","only","-","Sep","15",["3","0","0",null],"0","S"],["1951","only","-","Apr","1",["0","0","0",null],"60","D"],["1951","only","-","Nov","11",["3","0","0",null],"0","S"],["1952","only","-","Apr","20",["2","0","0",null],"60","D"],["1952","only","-","Oct","19",["3","0","0",null],"0","S"],["1953","only","-","Apr","12",["2","0","0",null],"60","D"],["1953","only","-","Sep","13",["3","0","0",null],"0","S"],["1954","only","-","Jun","13",["0","0","0",null],"60","D"],["1954","only","-","Sep","12",["0","0","0",null],"0","S"],["1955","only","-","Jun","11",["2","0","0",null],"60","D"],["1955","only","-","Sep","11",["0","0","0",null],"0","S"],["1956","only","-","Jun","3",["0","0","0",null],"60","D"],["1956","only","-","Sep","30",["3","0","0",null],"0","S"],["1957","only","-","Apr","29",["2","0","0",null],"60","D"],["1957","only","-","Sep","22",["0","0","0",null],"0","S"],["1974","only","-","Jul","7",["0","0","0",null],"60","D"],["1974","only","-","Oct","13",["0","0","0",null],"0","S"],["1975","only","-","Apr","20",["0","0","0",null],"60","D"],["1975","only","-","Aug","31",["0","0","0",null],"0","S"],["1985","only","-","Apr","14",["0","0","0",null],"60","D"],["1985","only","-","Sep","15",["0","0","0",null],"0","S"],["1986","only","-","May","18",["0","0","0",null],"60","D"],["1986","only","-","Sep","7",["0","0","0",null],"0","S"],["1987","only","-","Apr","15",["0","0","0",null],"60","D"],["1987","only","-","Sep","13",["0","0","0",null],"0","S"],["1988","only","-","Apr","10",["0","0","0",null],"60","D"],["1988","only","-","Sep","4",["0","0","0",null],"0","S"],["1989","only","-","Apr","30",["0","0","0",null],"60","D"],["1989","only","-","Sep","3",["0","0","0",null],"0","S"],["1990","only","-","Mar","25",["0","0","0",null],"60","D"],["1990","only","-","Aug","26",["0","0","0",null],"0","S"],["1991","only","-","Mar","24",["0","0","0",null],"60","D"],["1991","only","-","Sep","1",["0","0","0",null],"0","S"],["1992","only","-","Mar","29",["0","0","0",null],"60","D"],["1992","only","-","Sep","6",["0","0","0",null],"0","S"],["1993","only","-","Apr","2",["0","0","0",null],"60","D"],["1993","only","-","Sep","5",["0","0","0",null],"0","S"],["1994","only","-","Apr","1",["0","0","0",null],"60","D"],["1994","only","-","Aug","28",["0","0","0",null],"0","S"],["1995","only","-","Mar","31",["0","0","0",null],"60","D"],["1995","only","-","Sep","3",["0","0","0",null],"0","S"],["1996","only","-","Mar","15",["0","0","0",null],"60","D"],["1996","only","-","Sep","16",["0","0","0",null],"0","S"],["1997","only","-","Mar","21",["0","0","0",null],"60","D"],["1997","only","-","Sep","14",["0","0","0",null],"0","S"],["1998","only","-","Mar","20",["0","0","0",null],"60","D"],["1998","only","-","Sep","6",["0","0","0",null],"0","S"],["1999","only","-","Apr","2",["2","0","0",null],"60","D"],["1999","only","-","Sep","3",["2","0","0",null],"0","S"],["2000","only","-","Apr","14",["2","0","0",null],"60","D"],["2000","only","-","Oct","6",["1","0","0",null],"0","S"],["2001","only","-","Apr","9",["1","0","0",null],"60","D"],["2001","only","-","Sep","24",["1","0","0",null],"0","S"],["2002","only","-","Mar","29",["1","0","0",null],"60","D"],["2002","only","-","Oct","7",["1","0","0",null],"0","S"],["2003","only","-","Mar","28",["1","0","0",null],"60","D"],["2003","only","-","Oct","3",["1","0","0",null],"0","S"],["2004","only","-","Apr","7",["1","0","0",null],"60","D"],["2004","only","-","Sep","22",["1","0","0",null],"0","S"],["2005","only","-","Apr","1",["2","0","0",null],"60","D"],["2005","only","-","Oct","9",["2","0","0",null],"0","S"],["2006","2010","-","Mar","Fri>=26",["2","0","0",null],"60","D"],["2006","only","-","Oct","1",["2","0","0",null],"0","S"],["2007","only","-","Sep","16",["2","0","0",null],"0","S"],["2008","only","-","Oct","5",["2","0","0",null],"0","S"],["2009","only","-","Sep","27",["2","0","0",null],"0","S"],["2010","only","-","Sep","12",["2","0","0",null],"0","S"],["2011","only","-","Apr","1",["2","0","0",null],"60","D"],["2011","only","-","Oct","2",["2","0","0",null],"0","S"],["2012","only","-","Mar","Fri>=26",["2","0","0",null],"60","D"],["2012","only","-","Sep","23",["2","0","0",null],"0","S"],["2013","max","-","Mar","Fri>=23",["2","0","0",null],"60","D"],["2013","max","-","Oct","lastSun",["2","0","0",null],"0","S"]],"Japan":[["1948","only","-","May","Sat>=1",["24","0","0",null],"60","D"],["1948","1951","-","Sep","Sun>=9",["0","0","0",null],"0","S"],["1949","only","-","Apr","Sat>=1",["24","0","0",null],"60","D"],["1950","1951","-","May","Sat>=1",["24","0","0",null],"60","D"]],"Jordan":[["1973","only","-","Jun","6",["0","0","0",null],"60","S"],["1973","1975","-","Oct","1",["0","0","0",null],"0","-"],["1974","1977","-","May","1",["0","0","0",null],"60","S"],["1976","only","-","Nov","1",["0","0","0",null],"0","-"],["1977","only","-","Oct","1",["0","0","0",null],"0","-"],["1978","only","-","Apr","30",["0","0","0",null],"60","S"],["1978","only","-","Sep","30",["0","0","0",null],"0","-"],["1985","only","-","Apr","1",["0","0","0",null],"60","S"],["1985","only","-","Oct","1",["0","0","0",null],"0","-"],["1986","1988","-","Apr","Fri>=1",["0","0","0",null],"60","S"],["1986","1990","-","Oct","Fri>=1",["0","0","0",null],"0","-"],["1989","only","-","May","8",["0","0","0",null],"60","S"],["1990","only","-","Apr","27",["0","0","0",null],"60","S"],["1991","only","-","Apr","17",["0","0","0",null],"60","S"],["1991","only","-","Sep","27",["0","0","0",null],"0","-"],["1992","only","-","Apr","10",["0","0","0",null],"60","S"],["1992","1993","-","Oct","Fri>=1",["0","0","0",null],"0","-"],["1993","1998","-","Apr","Fri>=1",["0","0","0",null],"60","S"],["1994","only","-","Sep","Fri>=15",["0","0","0",null],"0","-"],["1995","1998","-","Sep","Fri>=15",["0","0","0","s"],"0","-"],["1999","only","-","Jul","1",["0","0","0","s"],"60","S"],["1999","2002","-","Sep","lastFri",["0","0","0","s"],"0","-"],["2000","2001","-","Mar","lastThu",["0","0","0","s"],"60","S"],["2002","2012","-","Mar","lastThu",["24","0","0",null],"60","S"],["2003","only","-","Oct","24",["0","0","0","s"],"0","-"],["2004","only","-","Oct","15",["0","0","0","s"],"0","-"],["2005","only","-","Sep","lastFri",["0","0","0","s"],"0","-"],["2006","2011","-","Oct","lastFri",["0","0","0","s"],"0","-"],["2013","only","-","Dec","20",["0","0","0",null],"0","-"],["2014","max","-","Mar","lastThu",["24","0","0",null],"60","S"],["2014","max","-","Oct","lastFri",["0","0","0","s"],"0","-"]],"Kyrgyz":[["1992","1996","-","Apr","Sun>=7",["0","0","0","s"],"60","S"],["1992","1996","-","Sep","lastSun",["0","0","0",null],"0","-"],["1997","2005","-","Mar","lastSun",["2","30","0",null],"60","S"],["1997","2004","-","Oct","lastSun",["2","30","0",null],"0","-"]],"ROK":[["1948","only","-","Jun","1",["0","0","0",null],"60","D"],["1948","only","-","Sep","13",["0","0","0",null],"0","S"],["1949","only","-","Apr","3",["0","0","0",null],"60","D"],["1949","1951","-","Sep","Sun>=8",["0","0","0",null],"0","S"],["1950","only","-","Apr","1",["0","0","0",null],"60","D"],["1951","only","-","May","6",["0","0","0",null],"60","D"],["1955","only","-","May","5",["0","0","0",null],"60","D"],["1955","only","-","Sep","9",["0","0","0",null],"0","S"],["1956","only","-","May","20",["0","0","0",null],"60","D"],["1956","only","-","Sep","30",["0","0","0",null],"0","S"],["1957","1960","-","May","Sun>=1",["0","0","0",null],"60","D"],["1957","1960","-","Sep","Sun>=18",["0","0","0",null],"0","S"],["1987","1988","-","May","Sun>=8",["2","0","0",null],"60","D"],["1987","1988","-","Oct","Sun>=8",["3","0","0",null],"0","S"]],"Lebanon":[["1920","only","-","Mar","28",["0","0","0",null],"60","S"],["1920","only","-","Oct","25",["0","0","0",null],"0","-"],["1921","only","-","Apr","3",["0","0","0",null],"60","S"],["1921","only","-","Oct","3",["0","0","0",null],"0","-"],["1922","only","-","Mar","26",["0","0","0",null],"60","S"],["1922","only","-","Oct","8",["0","0","0",null],"0","-"],["1923","only","-","Apr","22",["0","0","0",null],"60","S"],["1923","only","-","Sep","16",["0","0","0",null],"0","-"],["1957","1961","-","May","1",["0","0","0",null],"60","S"],["1957","1961","-","Oct","1",["0","0","0",null],"0","-"],["1972","only","-","Jun","22",["0","0","0",null],"60","S"],["1972","1977","-","Oct","1",["0","0","0",null],"0","-"],["1973","1977","-","May","1",["0","0","0",null],"60","S"],["1978","only","-","Apr","30",["0","0","0",null],"60","S"],["1978","only","-","Sep","30",["0","0","0",null],"0","-"],["1984","1987","-","May","1",["0","0","0",null],"60","S"],["1984","1991","-","Oct","16",["0","0","0",null],"0","-"],["1988","only","-","Jun","1",["0","0","0",null],"60","S"],["1989","only","-","May","10",["0","0","0",null],"60","S"],["1990","1992","-","May","1",["0","0","0",null],"60","S"],["1992","only","-","Oct","4",["0","0","0",null],"0","-"],["1993","max","-","Mar","lastSun",["0","0","0",null],"60","S"],["1993","1998","-","Sep","lastSun",["0","0","0",null],"0","-"],["1999","max","-","Oct","lastSun",["0","0","0",null],"0","-"]],"NBorneo":[["1935","1941","-","Sep","14",["0","0","0",null],"20","TS",""],["1935","1941","-","Dec","14",["0","0","0",null],"0","-"]],"Mongol":[["1983","1984","-","Apr","1",["0","0","0",null],"60","S"],["1983","only","-","Oct","1",["0","0","0",null],"0","-"],["1985","1998","-","Mar","lastSun",["0","0","0",null],"60","S"],["1984","1998","-","Sep","lastSun",["0","0","0",null],"0","-"],["2001","only","-","Apr","lastSat",["2","0","0",null],"60","S"],["2001","2006","-","Sep","lastSat",["2","0","0",null],"0","-"],["2002","2006","-","Mar","lastSat",["2","0","0",null],"60","S"],["2015","2016","-","Mar","lastSat",["2","0","0",null],"60","S"],["2015","2016","-","Sep","lastSat",["0","0","0",null],"0","-"]],"Pakistan":[["2002","only","-","Apr","Sun>=2",["0","0","0",null],"60","S"],["2002","only","-","Oct","Sun>=2",["0","0","0",null],"0","-"],["2008","only","-","Jun","1",["0","0","0",null],"60","S"],["2008","2009","-","Nov","1",["0","0","0",null],"0","-"],["2009","only","-","Apr","15",["0","0","0",null],"60","S"]],"EgyptAsia":[["1957","only","-","May","10",["0","0","0",null],"60","S"],["1957","1958","-","Oct","1",["0","0","0",null],"0","-"],["1958","only","-","May","1",["0","0","0",null],"60","S"],["1959","1967","-","May","1",["1","0","0",null],"60","S"],["1959","1965","-","Sep","30",["3","0","0",null],"0","-"],["1966","only","-","Oct","1",["3","0","0",null],"0","-"]],"Palestine":[["1999","2005","-","Apr","Fri>=15",["0","0","0",null],"60","S"],["1999","2003","-","Oct","Fri>=15",["0","0","0",null],"0","-"],["2004","only","-","Oct","1",["1","0","0",null],"0","-"],["2005","only","-","Oct","4",["2","0","0",null],"0","-"],["2006","2007","-","Apr","1",["0","0","0",null],"60","S"],["2006","only","-","Sep","22",["0","0","0",null],"0","-"],["2007","only","-","Sep","Thu>=8",["2","0","0",null],"0","-"],["2008","2009","-","Mar","lastFri",["0","0","0",null],"60","S"],["2008","only","-","Sep","1",["0","0","0",null],"0","-"],["2009","only","-","Sep","Fri>=1",["1","0","0",null],"0","-"],["2010","only","-","Mar","26",["0","0","0",null],"60","S"],["2010","only","-","Aug","11",["0","0","0",null],"0","-"],["2011","only","-","Apr","1",["0","1","0",null],"60","S"],["2011","only","-","Aug","1",["0","0","0",null],"0","-"],["2011","only","-","Aug","30",["0","0","0",null],"60","S"],["2011","only","-","Sep","30",["0","0","0",null],"0","-"],["2012","2014","-","Mar","lastThu",["24","0","0",null],"60","S"],["2012","only","-","Sep","21",["1","0","0",null],"0","-"],["2013","only","-","Sep","Fri>=21",["0","0","0",null],"0","-"],["2014","2015","-","Oct","Fri>=21",["0","0","0",null],"0","-"],["2015","only","-","Mar","lastFri",["24","0","0",null],"60","S"],["2016","max","-","Mar","lastSat",["1","0","0",null],"60","S"],["2016","max","-","Oct","lastSat",["1","0","0",null],"0","-"]],"Phil":[["1936","only","-","Nov","1",["0","0","0",null],"60","S"],["1937","only","-","Feb","1",["0","0","0",null],"0","-"],["1954","only","-","Apr","12",["0","0","0",null],"60","S"],["1954","only","-","Jul","1",["0","0","0",null],"0","-"],["1978","only","-","Mar","22",["0","0","0",null],"60","S"],["1978","only","-","Sep","21",["0","0","0",null],"0","-"]],"Syria":[["1920","1923","-","Apr","Sun>=15",["2","0","0",null],"60","S"],["1920","1923","-","Oct","Sun>=1",["2","0","0",null],"0","-"],["1962","only","-","Apr","29",["2","0","0",null],"60","S"],["1962","only","-","Oct","1",["2","0","0",null],"0","-"],["1963","1965","-","May","1",["2","0","0",null],"60","S"],["1963","only","-","Sep","30",["2","0","0",null],"0","-"],["1964","only","-","Oct","1",["2","0","0",null],"0","-"],["1965","only","-","Sep","30",["2","0","0",null],"0","-"],["1966","only","-","Apr","24",["2","0","0",null],"60","S"],["1966","1976","-","Oct","1",["2","0","0",null],"0","-"],["1967","1978","-","May","1",["2","0","0",null],"60","S"],["1977","1978","-","Sep","1",["2","0","0",null],"0","-"],["1983","1984","-","Apr","9",["2","0","0",null],"60","S"],["1983","1984","-","Oct","1",["2","0","0",null],"0","-"],["1986","only","-","Feb","16",["2","0","0",null],"60","S"],["1986","only","-","Oct","9",["2","0","0",null],"0","-"],["1987","only","-","Mar","1",["2","0","0",null],"60","S"],["1987","1988","-","Oct","31",["2","0","0",null],"0","-"],["1988","only","-","Mar","15",["2","0","0",null],"60","S"],["1989","only","-","Mar","31",["2","0","0",null],"60","S"],["1989","only","-","Oct","1",["2","0","0",null],"0","-"],["1990","only","-","Apr","1",["2","0","0",null],"60","S"],["1990","only","-","Sep","30",["2","0","0",null],"0","-"],["1991","only","-","Apr","1",["0","0","0",null],"60","S"],["1991","1992","-","Oct","1",["0","0","0",null],"0","-"],["1992","only","-","Apr","8",["0","0","0",null],"60","S"],["1993","only","-","Mar","26",["0","0","0",null],"60","S"],["1993","only","-","Sep","25",["0","0","0",null],"0","-"],["1994","1996","-","Apr","1",["0","0","0",null],"60","S"],["1994","2005","-","Oct","1",["0","0","0",null],"0","-"],["1997","1998","-","Mar","lastMon",["0","0","0",null],"60","S"],["1999","2006","-","Apr","1",["0","0","0",null],"60","S"],["2006","only","-","Sep","22",["0","0","0",null],"0","-"],["2007","only","-","Mar","lastFri",["0","0","0",null],"60","S"],["2007","only","-","Nov","Fri>=1",["0","0","0",null],"0","-"],["2008","only","-","Apr","Fri>=1",["0","0","0",null],"60","S"],["2008","only","-","Nov","1",["0","0","0",null],"0","-"],["2009","only","-","Mar","lastFri",["0","0","0",null],"60","S"],["2010","2011","-","Apr","Fri>=1",["0","0","0",null],"60","S"],["2012","max","-","Mar","lastFri",["0","0","0",null],"60","S"],["2009","max","-","Oct","lastFri",["0","0","0",null],"0","-"]],"Aus":[["1917","only","-","Jan","1",["0","1","0",null],"60","D"],["1917","only","-","Mar","25",["2","0","0",null],"0","S"],["1942","only","-","Jan","1",["2","0","0",null],"60","D"],["1942","only","-","Mar","29",["2","0","0",null],"0","S"],["1942","only","-","Sep","27",["2","0","0",null],"60","D"],["1943","1944","-","Mar","lastSun",["2","0","0",null],"0","S"],["1943","only","-","Oct","3",["2","0","0",null],"60","D"]],"AW":[["1974","only","-","Oct","lastSun",["2","0","0","s"],"60","D"],["1975","only","-","Mar","Sun>=1",["2","0","0","s"],"0","S"],["1983","only","-","Oct","lastSun",["2","0","0","s"],"60","D"],["1984","only","-","Mar","Sun>=1",["2","0","0","s"],"0","S"],["1991","only","-","Nov","17",["2","0","0","s"],"60","D"],["1992","only","-","Mar","Sun>=1",["2","0","0","s"],"0","S"],["2006","only","-","Dec","3",["2","0","0","s"],"60","D"],["2007","2009","-","Mar","lastSun",["2","0","0","s"],"0","S"],["2007","2008","-","Oct","lastSun",["2","0","0","s"],"60","D"]],"AQ":[["1971","only","-","Oct","lastSun",["2","0","0","s"],"60","D"],["1972","only","-","Feb","lastSun",["2","0","0","s"],"0","S"],["1989","1991","-","Oct","lastSun",["2","0","0","s"],"60","D"],["1990","1992","-","Mar","Sun>=1",["2","0","0","s"],"0","S"]],"Holiday":[["1992","1993","-","Oct","lastSun",["2","0","0","s"],"60","D"],["1993","1994","-","Mar","Sun>=1",["2","0","0","s"],"0","S"]],"AS":[["1971","1985","-","Oct","lastSun",["2","0","0","s"],"60","D"],["1986","only","-","Oct","19",["2","0","0","s"],"60","D"],["1987","2007","-","Oct","lastSun",["2","0","0","s"],"60","D"],["1972","only","-","Feb","27",["2","0","0","s"],"0","S"],["1973","1985","-","Mar","Sun>=1",["2","0","0","s"],"0","S"],["1986","1990","-","Mar","Sun>=15",["2","0","0","s"],"0","S"],["1991","only","-","Mar","3",["2","0","0","s"],"0","S"],["1992","only","-","Mar","22",["2","0","0","s"],"0","S"],["1993","only","-","Mar","7",["2","0","0","s"],"0","S"],["1994","only","-","Mar","20",["2","0","0","s"],"0","S"],["1995","2005","-","Mar","lastSun",["2","0","0","s"],"0","S"],["2006","only","-","Apr","2",["2","0","0","s"],"0","S"],["2007","only","-","Mar","lastSun",["2","0","0","s"],"0","S"],["2008","max","-","Apr","Sun>=1",["2","0","0","s"],"0","S"],["2008","max","-","Oct","Sun>=1",["2","0","0","s"],"60","D"]],"AT":[["1967","only","-","Oct","Sun>=1",["2","0","0","s"],"60","D"],["1968","only","-","Mar","lastSun",["2","0","0","s"],"0","S"],["1968","1985","-","Oct","lastSun",["2","0","0","s"],"60","D"],["1969","1971","-","Mar","Sun>=8",["2","0","0","s"],"0","S"],["1972","only","-","Feb","lastSun",["2","0","0","s"],"0","S"],["1973","1981","-","Mar","Sun>=1",["2","0","0","s"],"0","S"],["1982","1983","-","Mar","lastSun",["2","0","0","s"],"0","S"],["1984","1986","-","Mar","Sun>=1",["2","0","0","s"],"0","S"],["1986","only","-","Oct","Sun>=15",["2","0","0","s"],"60","D"],["1987","1990","-","Mar","Sun>=15",["2","0","0","s"],"0","S"],["1987","only","-","Oct","Sun>=22",["2","0","0","s"],"60","D"],["1988","1990","-","Oct","lastSun",["2","0","0","s"],"60","D"],["1991","1999","-","Oct","Sun>=1",["2","0","0","s"],"60","D"],["1991","2005","-","Mar","lastSun",["2","0","0","s"],"0","S"],["2000","only","-","Aug","lastSun",["2","0","0","s"],"60","D"],["2001","max","-","Oct","Sun>=1",["2","0","0","s"],"60","D"],["2006","only","-","Apr","Sun>=1",["2","0","0","s"],"0","S"],["2007","only","-","Mar","lastSun",["2","0","0","s"],"0","S"],["2008","max","-","Apr","Sun>=1",["2","0","0","s"],"0","S"]],"AV":[["1971","1985","-","Oct","lastSun",["2","0","0","s"],"60","D"],["1972","only","-","Feb","lastSun",["2","0","0","s"],"0","S"],["1973","1985","-","Mar","Sun>=1",["2","0","0","s"],"0","S"],["1986","1990","-","Mar","Sun>=15",["2","0","0","s"],"0","S"],["1986","1987","-","Oct","Sun>=15",["2","0","0","s"],"60","D"],["1988","1999","-","Oct","lastSun",["2","0","0","s"],"60","D"],["1991","1994","-","Mar","Sun>=1",["2","0","0","s"],"0","S"],["1995","2005","-","Mar","lastSun",["2","0","0","s"],"0","S"],["2000","only","-","Aug","lastSun",["2","0","0","s"],"60","D"],["2001","2007","-","Oct","lastSun",["2","0","0","s"],"60","D"],["2006","only","-","Apr","Sun>=1",["2","0","0","s"],"0","S"],["2007","only","-","Mar","lastSun",["2","0","0","s"],"0","S"],["2008","max","-","Apr","Sun>=1",["2","0","0","s"],"0","S"],["2008","max","-","Oct","Sun>=1",["2","0","0","s"],"60","D"]],"AN":[["1971","1985","-","Oct","lastSun",["2","0","0","s"],"60","D"],["1972","only","-","Feb","27",["2","0","0","s"],"0","S"],["1973","1981","-","Mar","Sun>=1",["2","0","0","s"],"0","S"],["1982","only","-","Apr","Sun>=1",["2","0","0","s"],"0","S"],["1983","1985","-","Mar","Sun>=1",["2","0","0","s"],"0","S"],["1986","1989","-","Mar","Sun>=15",["2","0","0","s"],"0","S"],["1986","only","-","Oct","19",["2","0","0","s"],"60","D"],["1987","1999","-","Oct","lastSun",["2","0","0","s"],"60","D"],["1990","1995","-","Mar","Sun>=1",["2","0","0","s"],"0","S"],["1996","2005","-","Mar","lastSun",["2","0","0","s"],"0","S"],["2000","only","-","Aug","lastSun",["2","0","0","s"],"60","D"],["2001","2007","-","Oct","lastSun",["2","0","0","s"],"60","D"],["2006","only","-","Apr","Sun>=1",["2","0","0","s"],"0","S"],["2007","only","-","Mar","lastSun",["2","0","0","s"],"0","S"],["2008","max","-","Apr","Sun>=1",["2","0","0","s"],"0","S"],["2008","max","-","Oct","Sun>=1",["2","0","0","s"],"60","D"]],"LH":[["1981","1984","-","Oct","lastSun",["2","0","0",null],"60","D"],["1982","1985","-","Mar","Sun>=1",["2","0","0",null],"0","S"],["1985","only","-","Oct","lastSun",["2","0","0",null],"30","D"],["1986","1989","-","Mar","Sun>=15",["2","0","0",null],"0","S"],["1986","only","-","Oct","19",["2","0","0",null],"30","D"],["1987","1999","-","Oct","lastSun",["2","0","0",null],"30","D"],["1990","1995","-","Mar","Sun>=1",["2","0","0",null],"0","S"],["1996","2005","-","Mar","lastSun",["2","0","0",null],"0","S"],["2000","only","-","Aug","lastSun",["2","0","0",null],"30","D"],["2001","2007","-","Oct","lastSun",["2","0","0",null],"30","D"],["2006","only","-","Apr","Sun>=1",["2","0","0",null],"0","S"],["2007","only","-","Mar","lastSun",["2","0","0",null],"0","S"],["2008","max","-","Apr","Sun>=1",["2","0","0",null],"0","S"],["2008","max","-","Oct","Sun>=1",["2","0","0",null],"30","D"]],"Fiji":[["1998","1999","-","Nov","Sun>=1",["2","0","0",null],"60","S"],["1999","2000","-","Feb","lastSun",["3","0","0",null],"0","-"],["2009","only","-","Nov","29",["2","0","0",null],"60","S"],["2010","only","-","Mar","lastSun",["3","0","0",null],"0","-"],["2010","2013","-","Oct","Sun>=21",["2","0","0",null],"60","S"],["2011","only","-","Mar","Sun>=1",["3","0","0",null],"0","-"],["2012","2013","-","Jan","Sun>=18",["3","0","0",null],"0","-"],["2014","only","-","Jan","Sun>=18",["2","0","0",null],"0","-"],["2014","max","-","Nov","Sun>=1",["2","0","0",null],"60","S"],["2015","max","-","Jan","Sun>=14",["3","0","0",null],"0","-"]],"NC":[["1977","1978","-","Dec","Sun>=1",["0","0","0",null],"60","S"],["1978","1979","-","Feb","27",["0","0","0",null],"0","-"],["1996","only","-","Dec","1",["2","0","0","s"],"60","S"],["1997","only","-","Mar","2",["2","0","0","s"],"0","-"]],"NZ":[["1927","only","-","Nov","6",["2","0","0",null],"60","S"],["1928","only","-","Mar","4",["2","0","0",null],"0","M"],["1928","1933","-","Oct","Sun>=8",["2","0","0",null],"30","S"],["1929","1933","-","Mar","Sun>=15",["2","0","0",null],"0","M"],["1934","1940","-","Apr","lastSun",["2","0","0",null],"0","M"],["1934","1940","-","Sep","lastSun",["2","0","0",null],"30","S"],["1946","only","-","Jan","1",["0","0","0",null],"0","S"],["1974","only","-","Nov","Sun>=1",["2","0","0","s"],"60","D"],["1975","only","-","Feb","lastSun",["2","0","0","s"],"0","S"],["1975","1988","-","Oct","lastSun",["2","0","0","s"],"60","D"],["1976","1989","-","Mar","Sun>=1",["2","0","0","s"],"0","S"],["1989","only","-","Oct","Sun>=8",["2","0","0","s"],"60","D"],["1990","2006","-","Oct","Sun>=1",["2","0","0","s"],"60","D"],["1990","2007","-","Mar","Sun>=15",["2","0","0","s"],"0","S"],["2007","max","-","Sep","lastSun",["2","0","0","s"],"60","D"],["2008","max","-","Apr","Sun>=1",["2","0","0","s"],"0","S"]],"Chatham":[["1974","only","-","Nov","Sun>=1",["2","45","0","s"],"60","D"],["1975","only","-","Feb","lastSun",["2","45","0","s"],"0","S"],["1975","1988","-","Oct","lastSun",["2","45","0","s"],"60","D"],["1976","1989","-","Mar","Sun>=1",["2","45","0","s"],"0","S"],["1989","only","-","Oct","Sun>=8",["2","45","0","s"],"60","D"],["1990","2006","-","Oct","Sun>=1",["2","45","0","s"],"60","D"],["1990","2007","-","Mar","Sun>=15",["2","45","0","s"],"0","S"],["2007","max","-","Sep","lastSun",["2","45","0","s"],"60","D"],["2008","max","-","Apr","Sun>=1",["2","45","0","s"],"0","S"]],"Cook":[["1978","only","-","Nov","12",["0","0","0",null],"30","HS"],["1979","1991","-","Mar","Sun>=1",["0","0","0",null],"0","-"],["1979","1990","-","Oct","lastSun",["0","0","0",null],"30","HS"]],"WS":[["2010","only","-","Sep","lastSun",["0","0","0",null],"60","D"],["2011","only","-","Apr","Sat>=1",["4","0","0",null],"0","S"],["2011","only","-","Sep","lastSat",["3","0","0",null],"60","D"],["2012","max","-","Apr","Sun>=1",["4","0","0",null],"0","S"],["2012","max","-","Sep","lastSun",["3","0","0",null],"60","D"]],"Tonga":[["1999","only","-","Oct","7",["2","0","0","s"],"60","S"],["2000","only","-","Mar","19",["2","0","0","s"],"0","-"],["2000","2001","-","Nov","Sun>=1",["2","0","0",null],"60","S"],["2001","2002","-","Jan","lastSun",["2","0","0",null],"0","-"],["2016","only","-","Nov","Sun>=1",["2","0","0",null],"60","S"],["2017","only","-","Jan","Sun>=15",["3","0","0",null],"0","-"]],"Vanuatu":[["1983","only","-","Sep","25",["0","0","0",null],"60","S"],["1984","1991","-","Mar","Sun>=23",["0","0","0",null],"0","-"],["1984","only","-","Oct","23",["0","0","0",null],"60","S"],["1985","1991","-","Sep","Sun>=23",["0","0","0",null],"60","S"],["1992","1993","-","Jan","Sun>=23",["0","0","0",null],"0","-"],["1992","only","-","Oct","Sun>=23",["0","0","0",null],"60","S"]],"GB-Eire":[["1916","only","-","May","21",["2","0","0","s"],"60","BST"],["1916","only","-","Oct","1",["2","0","0","s"],"0","GMT"],["1917","only","-","Apr","8",["2","0","0","s"],"60","BST"],["1917","only","-","Sep","17",["2","0","0","s"],"0","GMT"],["1918","only","-","Mar","24",["2","0","0","s"],"60","BST"],["1918","only","-","Sep","30",["2","0","0","s"],"0","GMT"],["1919","only","-","Mar","30",["2","0","0","s"],"60","BST"],["1919","only","-","Sep","29",["2","0","0","s"],"0","GMT"],["1920","only","-","Mar","28",["2","0","0","s"],"60","BST"],["1920","only","-","Oct","25",["2","0","0","s"],"0","GMT"],["1921","only","-","Apr","3",["2","0","0","s"],"60","BST"],["1921","only","-","Oct","3",["2","0","0","s"],"0","GMT"],["1922","only","-","Mar","26",["2","0","0","s"],"60","BST"],["1922","only","-","Oct","8",["2","0","0","s"],"0","GMT"],["1923","only","-","Apr","Sun>=16",["2","0","0","s"],"60","BST"],["1923","1924","-","Sep","Sun>=16",["2","0","0","s"],"0","GMT"],["1924","only","-","Apr","Sun>=9",["2","0","0","s"],"60","BST"],["1925","1926","-","Apr","Sun>=16",["2","0","0","s"],"60","BST"],["1925","1938","-","Oct","Sun>=2",["2","0","0","s"],"0","GMT"],["1927","only","-","Apr","Sun>=9",["2","0","0","s"],"60","BST"],["1928","1929","-","Apr","Sun>=16",["2","0","0","s"],"60","BST"],["1930","only","-","Apr","Sun>=9",["2","0","0","s"],"60","BST"],["1931","1932","-","Apr","Sun>=16",["2","0","0","s"],"60","BST"],["1933","only","-","Apr","Sun>=9",["2","0","0","s"],"60","BST"],["1934","only","-","Apr","Sun>=16",["2","0","0","s"],"60","BST"],["1935","only","-","Apr","Sun>=9",["2","0","0","s"],"60","BST"],["1936","1937","-","Apr","Sun>=16",["2","0","0","s"],"60","BST"],["1938","only","-","Apr","Sun>=9",["2","0","0","s"],"60","BST"],["1939","only","-","Apr","Sun>=16",["2","0","0","s"],"60","BST"],["1939","only","-","Nov","Sun>=16",["2","0","0","s"],"0","GMT"],["1940","only","-","Feb","Sun>=23",["2","0","0","s"],"60","BST"],["1941","only","-","May","Sun>=2",["1","0","0","s"],"120","BDST"],["1941","1943","-","Aug","Sun>=9",["1","0","0","s"],"60","BST"],["1942","1944","-","Apr","Sun>=2",["1","0","0","s"],"120","BDST"],["1944","only","-","Sep","Sun>=16",["1","0","0","s"],"60","BST"],["1945","only","-","Apr","Mon>=2",["1","0","0","s"],"120","BDST"],["1945","only","-","Jul","Sun>=9",["1","0","0","s"],"60","BST"],["1945","1946","-","Oct","Sun>=2",["2","0","0","s"],"0","GMT"],["1946","only","-","Apr","Sun>=9",["2","0","0","s"],"60","BST"],["1947","only","-","Mar","16",["2","0","0","s"],"60","BST"],["1947","only","-","Apr","13",["1","0","0","s"],"120","BDST"],["1947","only","-","Aug","10",["1","0","0","s"],"60","BST"],["1947","only","-","Nov","2",["2","0","0","s"],"0","GMT"],["1948","only","-","Mar","14",["2","0","0","s"],"60","BST"],["1948","only","-","Oct","31",["2","0","0","s"],"0","GMT"],["1949","only","-","Apr","3",["2","0","0","s"],"60","BST"],["1949","only","-","Oct","30",["2","0","0","s"],"0","GMT"],["1950","1952","-","Apr","Sun>=14",["2","0","0","s"],"60","BST"],["1950","1952","-","Oct","Sun>=21",["2","0","0","s"],"0","GMT"],["1953","only","-","Apr","Sun>=16",["2","0","0","s"],"60","BST"],["1953","1960","-","Oct","Sun>=2",["2","0","0","s"],"0","GMT"],["1954","only","-","Apr","Sun>=9",["2","0","0","s"],"60","BST"],["1955","1956","-","Apr","Sun>=16",["2","0","0","s"],"60","BST"],["1957","only","-","Apr","Sun>=9",["2","0","0","s"],"60","BST"],["1958","1959","-","Apr","Sun>=16",["2","0","0","s"],"60","BST"],["1960","only","-","Apr","Sun>=9",["2","0","0","s"],"60","BST"],["1961","1963","-","Mar","lastSun",["2","0","0","s"],"60","BST"],["1961","1968","-","Oct","Sun>=23",["2","0","0","s"],"0","GMT"],["1964","1967","-","Mar","Sun>=19",["2","0","0","s"],"60","BST"],["1968","only","-","Feb","18",["2","0","0","s"],"60","BST"],["1972","1980","-","Mar","Sun>=16",["2","0","0","s"],"60","BST"],["1972","1980","-","Oct","Sun>=23",["2","0","0","s"],"0","GMT"],["1981","1995","-","Mar","lastSun",["1","0","0","u"],"60","BST"],["1981","1989","-","Oct","Sun>=23",["1","0","0","u"],"0","GMT"],["1990","1995","-","Oct","Sun>=22",["1","0","0","u"],"0","GMT"]],"EU":[["1977","1980","-","Apr","Sun>=1",["1","0","0","u"],"60","S"],["1977","only","-","Sep","lastSun",["1","0","0","u"],"0","-"],["1978","only","-","Oct","1",["1","0","0","u"],"0","-"],["1979","1995","-","Sep","lastSun",["1","0","0","u"],"0","-"],["1981","max","-","Mar","lastSun",["1","0","0","u"],"60","S"],["1996","max","-","Oct","lastSun",["1","0","0","u"],"0","-"]],"W-Eur":[["1977","1980","-","Apr","Sun>=1",["1","0","0","s"],"60","S"],["1977","only","-","Sep","lastSun",["1","0","0","s"],"0","-"],["1978","only","-","Oct","1",["1","0","0","s"],"0","-"],["1979","1995","-","Sep","lastSun",["1","0","0","s"],"0","-"],["1981","max","-","Mar","lastSun",["1","0","0","s"],"60","S"],["1996","max","-","Oct","lastSun",["1","0","0","s"],"0","-"]],"C-Eur":[["1916","only","-","Apr","30",["23","0","0",null],"60","S"],["1916","only","-","Oct","1",["1","0","0",null],"0","-"],["1917","1918","-","Apr","Mon>=15",["2","0","0","s"],"60","S"],["1917","1918","-","Sep","Mon>=15",["2","0","0","s"],"0","-"],["1940","only","-","Apr","1",["2","0","0","s"],"60","S"],["1942","only","-","Nov","2",["2","0","0","s"],"0","-"],["1943","only","-","Mar","29",["2","0","0","s"],"60","S"],["1943","only","-","Oct","4",["2","0","0","s"],"0","-"],["1944","1945","-","Apr","Mon>=1",["2","0","0","s"],"60","S"],["1944","only","-","Oct","2",["2","0","0","s"],"0","-"],["1945","only","-","Sep","16",["2","0","0","s"],"0","-"],["1977","1980","-","Apr","Sun>=1",["2","0","0","s"],"60","S"],["1977","only","-","Sep","lastSun",["2","0","0","s"],"0","-"],["1978","only","-","Oct","1",["2","0","0","s"],"0","-"],["1979","1995","-","Sep","lastSun",["2","0","0","s"],"0","-"],["1981","max","-","Mar","lastSun",["2","0","0","s"],"60","S"],["1996","max","-","Oct","lastSun",["2","0","0","s"],"0","-"]],"E-Eur":[["1977","1980","-","Apr","Sun>=1",["0","0","0",null],"60","S"],["1977","only","-","Sep","lastSun",["0","0","0",null],"0","-"],["1978","only","-","Oct","1",["0","0","0",null],"0","-"],["1979","1995","-","Sep","lastSun",["0","0","0",null],"0","-"],["1981","max","-","Mar","lastSun",["0","0","0",null],"60","S"],["1996","max","-","Oct","lastSun",["0","0","0",null],"0","-"]],"Russia":[["1917","only","-","Jul","1",["23","0","0",null],"60","MST",""],["1917","only","-","Dec","28",["0","0","0",null],"0","MMT",""],["1918","only","-","May","31",["22","0","0",null],"120","MDST",""],["1918","only","-","Sep","16",["1","0","0",null],"60","MST"],["1919","only","-","May","31",["23","0","0",null],"120","MDST"],["1919","only","-","Jul","1",["0","0","0","u"],"60","MSD"],["1919","only","-","Aug","16",["0","0","0",null],"0","MSK"],["1921","only","-","Feb","14",["23","0","0",null],"60","MSD"],["1921","only","-","Mar","20",["23","0","0",null],"120","+05"],["1921","only","-","Sep","1",["0","0","0",null],"60","MSD"],["1921","only","-","Oct","1",["0","0","0",null],"0","-"],["1981","1984","-","Apr","1",["0","0","0",null],"60","S"],["1981","1983","-","Oct","1",["0","0","0",null],"0","-"],["1984","1995","-","Sep","lastSun",["2","0","0","s"],"0","-"],["1985","2010","-","Mar","lastSun",["2","0","0","s"],"60","S"],["1996","2010","-","Oct","lastSun",["2","0","0","s"],"0","-"]],"Albania":[["1940","only","-","Jun","16",["0","0","0",null],"60","S"],["1942","only","-","Nov","2",["3","0","0",null],"0","-"],["1943","only","-","Mar","29",["2","0","0",null],"60","S"],["1943","only","-","Apr","10",["3","0","0",null],"0","-"],["1974","only","-","May","4",["0","0","0",null],"60","S"],["1974","only","-","Oct","2",["0","0","0",null],"0","-"],["1975","only","-","May","1",["0","0","0",null],"60","S"],["1975","only","-","Oct","2",["0","0","0",null],"0","-"],["1976","only","-","May","2",["0","0","0",null],"60","S"],["1976","only","-","Oct","3",["0","0","0",null],"0","-"],["1977","only","-","May","8",["0","0","0",null],"60","S"],["1977","only","-","Oct","2",["0","0","0",null],"0","-"],["1978","only","-","May","6",["0","0","0",null],"60","S"],["1978","only","-","Oct","1",["0","0","0",null],"0","-"],["1979","only","-","May","5",["0","0","0",null],"60","S"],["1979","only","-","Sep","30",["0","0","0",null],"0","-"],["1980","only","-","May","3",["0","0","0",null],"60","S"],["1980","only","-","Oct","4",["0","0","0",null],"0","-"],["1981","only","-","Apr","26",["0","0","0",null],"60","S"],["1981","only","-","Sep","27",["0","0","0",null],"0","-"],["1982","only","-","May","2",["0","0","0",null],"60","S"],["1982","only","-","Oct","3",["0","0","0",null],"0","-"],["1983","only","-","Apr","18",["0","0","0",null],"60","S"],["1983","only","-","Oct","1",["0","0","0",null],"0","-"],["1984","only","-","Apr","1",["0","0","0",null],"60","S"]],"Austria":[["1920","only","-","Apr","5",["2","0","0","s"],"60","S"],["1920","only","-","Sep","13",["2","0","0","s"],"0","-"],["1946","only","-","Apr","14",["2","0","0","s"],"60","S"],["1946","1948","-","Oct","Sun>=1",["2","0","0","s"],"0","-"],["1947","only","-","Apr","6",["2","0","0","s"],"60","S"],["1948","only","-","Apr","18",["2","0","0","s"],"60","S"],["1980","only","-","Apr","6",["0","0","0",null],"60","S"],["1980","only","-","Sep","28",["0","0","0",null],"0","-"]],"Belgium":[["1918","only","-","Mar","9",["0","0","0","s"],"60","S"],["1918","1919","-","Oct","Sat>=1",["23","0","0","s"],"0","-"],["1919","only","-","Mar","1",["23","0","0","s"],"60","S"],["1920","only","-","Feb","14",["23","0","0","s"],"60","S"],["1920","only","-","Oct","23",["23","0","0","s"],"0","-"],["1921","only","-","Mar","14",["23","0","0","s"],"60","S"],["1921","only","-","Oct","25",["23","0","0","s"],"0","-"],["1922","only","-","Mar","25",["23","0","0","s"],"60","S"],["1922","1927","-","Oct","Sat>=1",["23","0","0","s"],"0","-"],["1923","only","-","Apr","21",["23","0","0","s"],"60","S"],["1924","only","-","Mar","29",["23","0","0","s"],"60","S"],["1925","only","-","Apr","4",["23","0","0","s"],"60","S"],["1926","only","-","Apr","17",["23","0","0","s"],"60","S"],["1927","only","-","Apr","9",["23","0","0","s"],"60","S"],["1928","only","-","Apr","14",["23","0","0","s"],"60","S"],["1928","1938","-","Oct","Sun>=2",["2","0","0","s"],"0","-"],["1929","only","-","Apr","21",["2","0","0","s"],"60","S"],["1930","only","-","Apr","13",["2","0","0","s"],"60","S"],["1931","only","-","Apr","19",["2","0","0","s"],"60","S"],["1932","only","-","Apr","3",["2","0","0","s"],"60","S"],["1933","only","-","Mar","26",["2","0","0","s"],"60","S"],["1934","only","-","Apr","8",["2","0","0","s"],"60","S"],["1935","only","-","Mar","31",["2","0","0","s"],"60","S"],["1936","only","-","Apr","19",["2","0","0","s"],"60","S"],["1937","only","-","Apr","4",["2","0","0","s"],"60","S"],["1938","only","-","Mar","27",["2","0","0","s"],"60","S"],["1939","only","-","Apr","16",["2","0","0","s"],"60","S"],["1939","only","-","Nov","19",["2","0","0","s"],"0","-"],["1940","only","-","Feb","25",["2","0","0","s"],"60","S"],["1944","only","-","Sep","17",["2","0","0","s"],"0","-"],["1945","only","-","Apr","2",["2","0","0","s"],"60","S"],["1945","only","-","Sep","16",["2","0","0","s"],"0","-"],["1946","only","-","May","19",["2","0","0","s"],"60","S"],["1946","only","-","Oct","7",["2","0","0","s"],"0","-"]],"Bulg":[["1979","only","-","Mar","31",["23","0","0",null],"60","S"],["1979","only","-","Oct","1",["1","0","0",null],"0","-"],["1980","1982","-","Apr","Sat>=1",["23","0","0",null],"60","S"],["1980","only","-","Sep","29",["1","0","0",null],"0","-"],["1981","only","-","Sep","27",["2","0","0",null],"0","-"]],"Czech":[["1945","only","-","Apr","8",["2","0","0","s"],"60","S"],["1945","only","-","Nov","18",["2","0","0","s"],"0","-"],["1946","only","-","May","6",["2","0","0","s"],"60","S"],["1946","1949","-","Oct","Sun>=1",["2","0","0","s"],"0","-"],["1947","only","-","Apr","20",["2","0","0","s"],"60","S"],["1948","only","-","Apr","18",["2","0","0","s"],"60","S"],["1949","only","-","Apr","9",["2","0","0","s"],"60","S"]],"Denmark":[["1916","only","-","May","14",["23","0","0",null],"60","S"],["1916","only","-","Sep","30",["23","0","0",null],"0","-"],["1940","only","-","May","15",["0","0","0",null],"60","S"],["1945","only","-","Apr","2",["2","0","0","s"],"60","S"],["1945","only","-","Aug","15",["2","0","0","s"],"0","-"],["1946","only","-","May","1",["2","0","0","s"],"60","S"],["1946","only","-","Sep","1",["2","0","0","s"],"0","-"],["1947","only","-","May","4",["2","0","0","s"],"60","S"],["1947","only","-","Aug","10",["2","0","0","s"],"0","-"],["1948","only","-","May","9",["2","0","0","s"],"60","S"],["1948","only","-","Aug","8",["2","0","0","s"],"0","-"]],"Thule":[["1991","1992","-","Mar","lastSun",["2","0","0",null],"60","D"],["1991","1992","-","Sep","lastSun",["2","0","0",null],"0","S"],["1993","2006","-","Apr","Sun>=1",["2","0","0",null],"60","D"],["1993","2006","-","Oct","lastSun",["2","0","0",null],"0","S"],["2007","max","-","Mar","Sun>=8",["2","0","0",null],"60","D"],["2007","max","-","Nov","Sun>=1",["2","0","0",null],"0","S"]],"Finland":[["1942","only","-","Apr","2",["24","0","0",null],"60","S"],["1942","only","-","Oct","4",["1","0","0",null],"0","-"],["1981","1982","-","Mar","lastSun",["2","0","0",null],"60","S"],["1981","1982","-","Sep","lastSun",["3","0","0",null],"0","-"]],"France":[["1916","only","-","Jun","14",["23","0","0","s"],"60","S"],["1916","1919","-","Oct","Sun>=1",["23","0","0","s"],"0","-"],["1917","only","-","Mar","24",["23","0","0","s"],"60","S"],["1918","only","-","Mar","9",["23","0","0","s"],"60","S"],["1919","only","-","Mar","1",["23","0","0","s"],"60","S"],["1920","only","-","Feb","14",["23","0","0","s"],"60","S"],["1920","only","-","Oct","23",["23","0","0","s"],"0","-"],["1921","only","-","Mar","14",["23","0","0","s"],"60","S"],["1921","only","-","Oct","25",["23","0","0","s"],"0","-"],["1922","only","-","Mar","25",["23","0","0","s"],"60","S"],["1922","1938","-","Oct","Sat>=1",["23","0","0","s"],"0","-"],["1923","only","-","May","26",["23","0","0","s"],"60","S"],["1924","only","-","Mar","29",["23","0","0","s"],"60","S"],["1925","only","-","Apr","4",["23","0","0","s"],"60","S"],["1926","only","-","Apr","17",["23","0","0","s"],"60","S"],["1927","only","-","Apr","9",["23","0","0","s"],"60","S"],["1928","only","-","Apr","14",["23","0","0","s"],"60","S"],["1929","only","-","Apr","20",["23","0","0","s"],"60","S"],["1930","only","-","Apr","12",["23","0","0","s"],"60","S"],["1931","only","-","Apr","18",["23","0","0","s"],"60","S"],["1932","only","-","Apr","2",["23","0","0","s"],"60","S"],["1933","only","-","Mar","25",["23","0","0","s"],"60","S"],["1934","only","-","Apr","7",["23","0","0","s"],"60","S"],["1935","only","-","Mar","30",["23","0","0","s"],"60","S"],["1936","only","-","Apr","18",["23","0","0","s"],"60","S"],["1937","only","-","Apr","3",["23","0","0","s"],"60","S"],["1938","only","-","Mar","26",["23","0","0","s"],"60","S"],["1939","only","-","Apr","15",["23","0","0","s"],"60","S"],["1939","only","-","Nov","18",["23","0","0","s"],"0","-"],["1940","only","-","Feb","25",["2","0","0",null],"60","S"],["1941","only","-","May","5",["0","0","0",null],"120","M",""],["1941","only","-","Oct","6",["0","0","0",null],"60","S"],["1942","only","-","Mar","9",["0","0","0",null],"120","M"],["1942","only","-","Nov","2",["3","0","0",null],"60","S"],["1943","only","-","Mar","29",["2","0","0",null],"120","M"],["1943","only","-","Oct","4",["3","0","0",null],"60","S"],["1944","only","-","Apr","3",["2","0","0",null],"120","M"],["1944","only","-","Oct","8",["1","0","0",null],"60","S"],["1945","only","-","Apr","2",["2","0","0",null],"120","M"],["1945","only","-","Sep","16",["3","0","0",null],"0","-"],["1976","only","-","Mar","28",["1","0","0",null],"60","S"],["1976","only","-","Sep","26",["1","0","0",null],"0","-"]],"Germany":[["1946","only","-","Apr","14",["2","0","0","s"],"60","S"],["1946","only","-","Oct","7",["2","0","0","s"],"0","-"],["1947","1949","-","Oct","Sun>=1",["2","0","0","s"],"0","-"],["1947","only","-","Apr","6",["3","0","0","s"],"60","S"],["1947","only","-","May","11",["2","0","0","s"],"120","M"],["1947","only","-","Jun","29",["3","0","0",null],"60","S"],["1948","only","-","Apr","18",["2","0","0","s"],"60","S"],["1949","only","-","Apr","10",["2","0","0","s"],"60","S"]],"SovietZone":[["1945","only","-","May","24",["2","0","0",null],"120","M",""],["1945","only","-","Sep","24",["3","0","0",null],"60","S"],["1945","only","-","Nov","18",["2","0","0","s"],"0","-"]],"Greece":[["1932","only","-","Jul","7",["0","0","0",null],"60","S"],["1932","only","-","Sep","1",["0","0","0",null],"0","-"],["1941","only","-","Apr","7",["0","0","0",null],"60","S"],["1942","only","-","Nov","2",["3","0","0",null],"0","-"],["1943","only","-","Mar","30",["0","0","0",null],"60","S"],["1943","only","-","Oct","4",["0","0","0",null],"0","-"],["1952","only","-","Jul","1",["0","0","0",null],"60","S"],["1952","only","-","Nov","2",["0","0","0",null],"0","-"],["1975","only","-","Apr","12",["0","0","0","s"],"60","S"],["1975","only","-","Nov","26",["0","0","0","s"],"0","-"],["1976","only","-","Apr","11",["2","0","0","s"],"60","S"],["1976","only","-","Oct","10",["2","0","0","s"],"0","-"],["1977","1978","-","Apr","Sun>=1",["2","0","0","s"],"60","S"],["1977","only","-","Sep","26",["2","0","0","s"],"0","-"],["1978","only","-","Sep","24",["4","0","0",null],"0","-"],["1979","only","-","Apr","1",["9","0","0",null],"60","S"],["1979","only","-","Sep","29",["2","0","0",null],"0","-"],["1980","only","-","Apr","1",["0","0","0",null],"60","S"],["1980","only","-","Sep","28",["0","0","0",null],"0","-"]],"Hungary":[["1918","only","-","Apr","1",["3","0","0",null],"60","S"],["1918","only","-","Sep","16",["3","0","0",null],"0","-"],["1919","only","-","Apr","15",["3","0","0",null],"60","S"],["1919","only","-","Nov","24",["3","0","0",null],"0","-"],["1945","only","-","May","1",["23","0","0",null],"60","S"],["1945","only","-","Nov","1",["0","0","0",null],"0","-"],["1946","only","-","Mar","31",["2","0","0","s"],"60","S"],["1946","1949","-","Oct","Sun>=1",["2","0","0","s"],"0","-"],["1947","1949","-","Apr","Sun>=4",["2","0","0","s"],"60","S"],["1950","only","-","Apr","17",["2","0","0","s"],"60","S"],["1950","only","-","Oct","23",["2","0","0","s"],"0","-"],["1954","1955","-","May","23",["0","0","0",null],"60","S"],["1954","1955","-","Oct","3",["0","0","0",null],"0","-"],["1956","only","-","Jun","Sun>=1",["0","0","0",null],"60","S"],["1956","only","-","Sep","lastSun",["0","0","0",null],"0","-"],["1957","only","-","Jun","Sun>=1",["1","0","0",null],"60","S"],["1957","only","-","Sep","lastSun",["3","0","0",null],"0","-"],["1980","only","-","Apr","6",["1","0","0",null],"60","S"]],"Iceland":[["1917","1919","-","Feb","19",["23","0","0",null],"60","S"],["1917","only","-","Oct","21",["1","0","0",null],"0","-"],["1918","1919","-","Nov","16",["1","0","0",null],"0","-"],["1921","only","-","Mar","19",["23","0","0",null],"60","S"],["1921","only","-","Jun","23",["1","0","0",null],"0","-"],["1939","only","-","Apr","29",["23","0","0",null],"60","S"],["1939","only","-","Oct","29",["2","0","0",null],"0","-"],["1940","only","-","Feb","25",["2","0","0",null],"60","S"],["1940","1941","-","Nov","Sun>=2",["1","0","0","s"],"0","-"],["1941","1942","-","Mar","Sun>=2",["1","0","0","s"],"60","S"],["1943","1946","-","Mar","Sun>=1",["1","0","0","s"],"60","S"],["1942","1948","-","Oct","Sun>=22",["1","0","0","s"],"0","-"],["1947","1967","-","Apr","Sun>=1",["1","0","0","s"],"60","S"],["1949","only","-","Oct","30",["1","0","0","s"],"0","-"],["1950","1966","-","Oct","Sun>=22",["1","0","0","s"],"0","-"],["1967","only","-","Oct","29",["1","0","0","s"],"0","-"]],"Italy":[["1916","only","-","Jun","3",["24","0","0",null],"60","S"],["1916","1917","-","Sep","30",["24","0","0",null],"0","-"],["1917","only","-","Mar","31",["24","0","0",null],"60","S"],["1918","only","-","Mar","9",["24","0","0",null],"60","S"],["1918","only","-","Oct","6",["24","0","0",null],"0","-"],["1919","only","-","Mar","1",["24","0","0",null],"60","S"],["1919","only","-","Oct","4",["24","0","0",null],"0","-"],["1920","only","-","Mar","20",["24","0","0",null],"60","S"],["1920","only","-","Sep","18",["24","0","0",null],"0","-"],["1940","only","-","Jun","14",["24","0","0",null],"60","S"],["1942","only","-","Nov","2",["2","0","0","s"],"0","-"],["1943","only","-","Mar","29",["2","0","0","s"],"60","S"],["1943","only","-","Oct","4",["2","0","0","s"],"0","-"],["1944","only","-","Apr","2",["2","0","0","s"],"60","S"],["1944","only","-","Sep","17",["2","0","0","s"],"0","-"],["1945","only","-","Apr","2",["2","0","0",null],"60","S"],["1945","only","-","Sep","15",["1","0","0",null],"0","-"],["1946","only","-","Mar","17",["2","0","0","s"],"60","S"],["1946","only","-","Oct","6",["2","0","0","s"],"0","-"],["1947","only","-","Mar","16",["0","0","0","s"],"60","S"],["1947","only","-","Oct","5",["0","0","0","s"],"0","-"],["1948","only","-","Feb","29",["2","0","0","s"],"60","S"],["1948","only","-","Oct","3",["2","0","0","s"],"0","-"],["1966","1968","-","May","Sun>=22",["0","0","0","s"],"60","S"],["1966","only","-","Sep","24",["24","0","0",null],"0","-"],["1967","1969","-","Sep","Sun>=22",["0","0","0","s"],"0","-"],["1969","only","-","Jun","1",["0","0","0","s"],"60","S"],["1970","only","-","May","31",["0","0","0","s"],"60","S"],["1970","only","-","Sep","lastSun",["0","0","0","s"],"0","-"],["1971","1972","-","May","Sun>=22",["0","0","0","s"],"60","S"],["1971","only","-","Sep","lastSun",["0","0","0","s"],"0","-"],["1972","only","-","Oct","1",["0","0","0","s"],"0","-"],["1973","only","-","Jun","3",["0","0","0","s"],"60","S"],["1973","1974","-","Sep","lastSun",["0","0","0","s"],"0","-"],["1974","only","-","May","26",["0","0","0","s"],"60","S"],["1975","only","-","Jun","1",["0","0","0","s"],"60","S"],["1975","1977","-","Sep","lastSun",["0","0","0","s"],"0","-"],["1976","only","-","May","30",["0","0","0","s"],"60","S"],["1977","1979","-","May","Sun>=22",["0","0","0","s"],"60","S"],["1978","only","-","Oct","1",["0","0","0","s"],"0","-"],["1979","only","-","Sep","30",["0","0","0","s"],"0","-"]],"Latvia":[["1989","1996","-","Mar","lastSun",["2","0","0","s"],"60","S"],["1989","1996","-","Sep","lastSun",["2","0","0","s"],"0","-"]],"Lux":[["1916","only","-","May","14",["23","0","0",null],"60","S"],["1916","only","-","Oct","1",["1","0","0",null],"0","-"],["1917","only","-","Apr","28",["23","0","0",null],"60","S"],["1917","only","-","Sep","17",["1","0","0",null],"0","-"],["1918","only","-","Apr","Mon>=15",["2","0","0","s"],"60","S"],["1918","only","-","Sep","Mon>=15",["2","0","0","s"],"0","-"],["1919","only","-","Mar","1",["23","0","0",null],"60","S"],["1919","only","-","Oct","5",["3","0","0",null],"0","-"],["1920","only","-","Feb","14",["23","0","0",null],"60","S"],["1920","only","-","Oct","24",["2","0","0",null],"0","-"],["1921","only","-","Mar","14",["23","0","0",null],"60","S"],["1921","only","-","Oct","26",["2","0","0",null],"0","-"],["1922","only","-","Mar","25",["23","0","0",null],"60","S"],["1922","only","-","Oct","Sun>=2",["1","0","0",null],"0","-"],["1923","only","-","Apr","21",["23","0","0",null],"60","S"],["1923","only","-","Oct","Sun>=2",["2","0","0",null],"0","-"],["1924","only","-","Mar","29",["23","0","0",null],"60","S"],["1924","1928","-","Oct","Sun>=2",["1","0","0",null],"0","-"],["1925","only","-","Apr","5",["23","0","0",null],"60","S"],["1926","only","-","Apr","17",["23","0","0",null],"60","S"],["1927","only","-","Apr","9",["23","0","0",null],"60","S"],["1928","only","-","Apr","14",["23","0","0",null],"60","S"],["1929","only","-","Apr","20",["23","0","0",null],"60","S"]],"Malta":[["1973","only","-","Mar","31",["0","0","0","s"],"60","S"],["1973","only","-","Sep","29",["0","0","0","s"],"0","-"],["1974","only","-","Apr","21",["0","0","0","s"],"60","S"],["1974","only","-","Sep","16",["0","0","0","s"],"0","-"],["1975","1979","-","Apr","Sun>=15",["2","0","0",null],"60","S"],["1975","1980","-","Sep","Sun>=15",["2","0","0",null],"0","-"],["1980","only","-","Mar","31",["2","0","0",null],"60","S"]],"Moldova":[["1997","max","-","Mar","lastSun",["2","0","0",null],"60","S"],["1997","max","-","Oct","lastSun",["3","0","0",null],"0","-"]],"Neth":[["1916","only","-","May","1",["0","0","0",null],"60","NST",""],["1916","only","-","Oct","1",["0","0","0",null],"0","AMT",""],["1917","only","-","Apr","16",["2","0","0","s"],"60","NST"],["1917","only","-","Sep","17",["2","0","0","s"],"0","AMT"],["1918","1921","-","Apr","Mon>=1",["2","0","0","s"],"60","NST"],["1918","1921","-","Sep","lastMon",["2","0","0","s"],"0","AMT"],["1922","only","-","Mar","lastSun",["2","0","0","s"],"60","NST"],["1922","1936","-","Oct","Sun>=2",["2","0","0","s"],"0","AMT"],["1923","only","-","Jun","Fri>=1",["2","0","0","s"],"60","NST"],["1924","only","-","Mar","lastSun",["2","0","0","s"],"60","NST"],["1925","only","-","Jun","Fri>=1",["2","0","0","s"],"60","NST"],["1926","1931","-","May","15",["2","0","0","s"],"60","NST"],["1932","only","-","May","22",["2","0","0","s"],"60","NST"],["1933","1936","-","May","15",["2","0","0","s"],"60","NST"],["1937","only","-","May","22",["2","0","0","s"],"60","NST"],["1937","only","-","Jul","1",["0","0","0",null],"60","S"],["1937","1939","-","Oct","Sun>=2",["2","0","0","s"],"0","-"],["1938","1939","-","May","15",["2","0","0","s"],"60","S"],["1945","only","-","Apr","2",["2","0","0","s"],"60","S"],["1945","only","-","Sep","16",["2","0","0","s"],"0","-"]],"Norway":[["1916","only","-","May","22",["1","0","0",null],"60","S"],["1916","only","-","Sep","30",["0","0","0",null],"0","-"],["1945","only","-","Apr","2",["2","0","0","s"],"60","S"],["1945","only","-","Oct","1",["2","0","0","s"],"0","-"],["1959","1964","-","Mar","Sun>=15",["2","0","0","s"],"60","S"],["1959","1965","-","Sep","Sun>=15",["2","0","0","s"],"0","-"],["1965","only","-","Apr","25",["2","0","0","s"],"60","S"]],"Poland":[["1918","1919","-","Sep","16",["2","0","0","s"],"0","-"],["1919","only","-","Apr","15",["2","0","0","s"],"60","S"],["1944","only","-","Apr","3",["2","0","0","s"],"60","S"],["1944","only","-","Oct","4",["2","0","0",null],"0","-"],["1945","only","-","Apr","29",["0","0","0",null],"60","S"],["1945","only","-","Nov","1",["0","0","0",null],"0","-"],["1946","only","-","Apr","14",["0","0","0","s"],"60","S"],["1946","only","-","Oct","7",["2","0","0","s"],"0","-"],["1947","only","-","May","4",["2","0","0","s"],"60","S"],["1947","1949","-","Oct","Sun>=1",["2","0","0","s"],"0","-"],["1948","only","-","Apr","18",["2","0","0","s"],"60","S"],["1949","only","-","Apr","10",["2","0","0","s"],"60","S"],["1957","only","-","Jun","2",["1","0","0","s"],"60","S"],["1957","1958","-","Sep","lastSun",["1","0","0","s"],"0","-"],["1958","only","-","Mar","30",["1","0","0","s"],"60","S"],["1959","only","-","May","31",["1","0","0","s"],"60","S"],["1959","1961","-","Oct","Sun>=1",["1","0","0","s"],"0","-"],["1960","only","-","Apr","3",["1","0","0","s"],"60","S"],["1961","1964","-","May","lastSun",["1","0","0","s"],"60","S"],["1962","1964","-","Sep","lastSun",["1","0","0","s"],"0","-"]],"Port":[["1916","only","-","Jun","17",["23","0","0",null],"60","S"],["1916","only","-","Nov","1",["1","0","0",null],"0","-"],["1917","only","-","Feb","28",["23","0","0","s"],"60","S"],["1917","1921","-","Oct","14",["23","0","0","s"],"0","-"],["1918","only","-","Mar","1",["23","0","0","s"],"60","S"],["1919","only","-","Feb","28",["23","0","0","s"],"60","S"],["1920","only","-","Feb","29",["23","0","0","s"],"60","S"],["1921","only","-","Feb","28",["23","0","0","s"],"60","S"],["1924","only","-","Apr","16",["23","0","0","s"],"60","S"],["1924","only","-","Oct","14",["23","0","0","s"],"0","-"],["1926","only","-","Apr","17",["23","0","0","s"],"60","S"],["1926","1929","-","Oct","Sat>=1",["23","0","0","s"],"0","-"],["1927","only","-","Apr","9",["23","0","0","s"],"60","S"],["1928","only","-","Apr","14",["23","0","0","s"],"60","S"],["1929","only","-","Apr","20",["23","0","0","s"],"60","S"],["1931","only","-","Apr","18",["23","0","0","s"],"60","S"],["1931","1932","-","Oct","Sat>=1",["23","0","0","s"],"0","-"],["1932","only","-","Apr","2",["23","0","0","s"],"60","S"],["1934","only","-","Apr","7",["23","0","0","s"],"60","S"],["1934","1938","-","Oct","Sat>=1",["23","0","0","s"],"0","-"],["1935","only","-","Mar","30",["23","0","0","s"],"60","S"],["1936","only","-","Apr","18",["23","0","0","s"],"60","S"],["1937","only","-","Apr","3",["23","0","0","s"],"60","S"],["1938","only","-","Mar","26",["23","0","0","s"],"60","S"],["1939","only","-","Apr","15",["23","0","0","s"],"60","S"],["1939","only","-","Nov","18",["23","0","0","s"],"0","-"],["1940","only","-","Feb","24",["23","0","0","s"],"60","S"],["1940","1941","-","Oct","5",["23","0","0","s"],"0","-"],["1941","only","-","Apr","5",["23","0","0","s"],"60","S"],["1942","1945","-","Mar","Sat>=8",["23","0","0","s"],"60","S"],["1942","only","-","Apr","25",["22","0","0","s"],"120","M",""],["1942","only","-","Aug","15",["22","0","0","s"],"60","S"],["1942","1945","-","Oct","Sat>=24",["23","0","0","s"],"0","-"],["1943","only","-","Apr","17",["22","0","0","s"],"120","M"],["1943","1945","-","Aug","Sat>=25",["22","0","0","s"],"60","S"],["1944","1945","-","Apr","Sat>=21",["22","0","0","s"],"120","M"],["1946","only","-","Apr","Sat>=1",["23","0","0","s"],"60","S"],["1946","only","-","Oct","Sat>=1",["23","0","0","s"],"0","-"],["1947","1949","-","Apr","Sun>=1",["2","0","0","s"],"60","S"],["1947","1949","-","Oct","Sun>=1",["2","0","0","s"],"0","-"],["1951","1965","-","Apr","Sun>=1",["2","0","0","s"],"60","S"],["1951","1965","-","Oct","Sun>=1",["2","0","0","s"],"0","-"],["1977","only","-","Mar","27",["0","0","0","s"],"60","S"],["1977","only","-","Sep","25",["0","0","0","s"],"0","-"],["1978","1979","-","Apr","Sun>=1",["0","0","0","s"],"60","S"],["1978","only","-","Oct","1",["0","0","0","s"],"0","-"],["1979","1982","-","Sep","lastSun",["1","0","0","s"],"0","-"],["1980","only","-","Mar","lastSun",["0","0","0","s"],"60","S"],["1981","1982","-","Mar","lastSun",["1","0","0","s"],"60","S"],["1983","only","-","Mar","lastSun",["2","0","0","s"],"60","S"]],"Romania":[["1932","only","-","May","21",["0","0","0","s"],"60","S"],["1932","1939","-","Oct","Sun>=1",["0","0","0","s"],"0","-"],["1933","1939","-","Apr","Sun>=2",["0","0","0","s"],"60","S"],["1979","only","-","May","27",["0","0","0",null],"60","S"],["1979","only","-","Sep","lastSun",["0","0","0",null],"0","-"],["1980","only","-","Apr","5",["23","0","0",null],"60","S"],["1980","only","-","Sep","lastSun",["1","0","0",null],"0","-"],["1991","1993","-","Mar","lastSun",["0","0","0","s"],"60","S"],["1991","1993","-","Sep","lastSun",["0","0","0","s"],"0","-"]],"Spain":[["1918","only","-","Apr","15",["23","0","0",null],"60","S"],["1918","1919","-","Oct","6",["24","0","0","s"],"0","-"],["1919","only","-","Apr","6",["23","0","0",null],"60","S"],["1924","only","-","Apr","16",["23","0","0",null],"60","S"],["1924","only","-","Oct","4",["24","0","0","s"],"0","-"],["1926","only","-","Apr","17",["23","0","0",null],"60","S"],["1926","1929","-","Oct","Sat>=1",["24","0","0","s"],"0","-"],["1927","only","-","Apr","9",["23","0","0",null],"60","S"],["1928","only","-","Apr","15",["0","0","0",null],"60","S"],["1929","only","-","Apr","20",["23","0","0",null],"60","S"],["1937","only","-","Jun","16",["23","0","0",null],"60","S"],["1937","only","-","Oct","2",["24","0","0","s"],"0","-"],["1938","only","-","Apr","2",["23","0","0",null],"60","S"],["1938","only","-","Apr","30",["23","0","0",null],"120","M"],["1938","only","-","Oct","2",["24","0","0",null],"60","S"],["1939","only","-","Oct","7",["24","0","0","s"],"0","-"],["1942","only","-","May","2",["23","0","0",null],"60","S"],["1942","only","-","Sep","1",["1","0","0",null],"0","-"],["1943","1946","-","Apr","Sat>=13",["23","0","0",null],"60","S"],["1943","1944","-","Oct","Sun>=1",["1","0","0",null],"0","-"],["1945","1946","-","Sep","lastSun",["1","0","0",null],"0","-"],["1949","only","-","Apr","30",["23","0","0",null],"60","S"],["1949","only","-","Oct","2",["1","0","0",null],"0","-"],["1974","1975","-","Apr","Sat>=12",["23","0","0",null],"60","S"],["1974","1975","-","Oct","Sun>=1",["1","0","0",null],"0","-"],["1976","only","-","Mar","27",["23","0","0",null],"60","S"],["1976","1977","-","Sep","lastSun",["1","0","0",null],"0","-"],["1977","only","-","Apr","2",["23","0","0",null],"60","S"],["1978","only","-","Apr","2",["2","0","0","s"],"60","S"],["1978","only","-","Oct","1",["2","0","0","s"],"0","-"]],"SpainAfrica":[["1967","only","-","Jun","3",["12","0","0",null],"60","S"],["1967","only","-","Oct","1",["0","0","0",null],"0","-"],["1974","only","-","Jun","24",["0","0","0",null],"60","S"],["1974","only","-","Sep","1",["0","0","0",null],"0","-"],["1976","1977","-","May","1",["0","0","0",null],"60","S"],["1976","only","-","Aug","1",["0","0","0",null],"0","-"],["1977","only","-","Sep","28",["0","0","0",null],"0","-"],["1978","only","-","Jun","1",["0","0","0",null],"60","S"],["1978","only","-","Aug","4",["0","0","0",null],"0","-"]],"Swiss":[["1941","1942","-","May","Mon>=1",["1","0","0",null],"60","S"],["1941","1942","-","Oct","Mon>=1",["2","0","0",null],"0","-"]],"Turkey":[["1916","only","-","May","1",["0","0","0",null],"60","S"],["1916","only","-","Oct","1",["0","0","0",null],"0","-"],["1920","only","-","Mar","28",["0","0","0",null],"60","S"],["1920","only","-","Oct","25",["0","0","0",null],"0","-"],["1921","only","-","Apr","3",["0","0","0",null],"60","S"],["1921","only","-","Oct","3",["0","0","0",null],"0","-"],["1922","only","-","Mar","26",["0","0","0",null],"60","S"],["1922","only","-","Oct","8",["0","0","0",null],"0","-"],["1924","only","-","May","13",["0","0","0",null],"60","S"],["1924","1925","-","Oct","1",["0","0","0",null],"0","-"],["1925","only","-","May","1",["0","0","0",null],"60","S"],["1940","only","-","Jun","30",["0","0","0",null],"60","S"],["1940","only","-","Oct","5",["0","0","0",null],"0","-"],["1940","only","-","Dec","1",["0","0","0",null],"60","S"],["1941","only","-","Sep","21",["0","0","0",null],"0","-"],["1942","only","-","Apr","1",["0","0","0",null],"60","S"],["1942","only","-","Nov","1",["0","0","0",null],"0","-"],["1945","only","-","Apr","2",["0","0","0",null],"60","S"],["1945","only","-","Oct","8",["0","0","0",null],"0","-"],["1946","only","-","Jun","1",["0","0","0",null],"60","S"],["1946","only","-","Oct","1",["0","0","0",null],"0","-"],["1947","1948","-","Apr","Sun>=16",["0","0","0",null],"60","S"],["1947","1950","-","Oct","Sun>=2",["0","0","0",null],"0","-"],["1949","only","-","Apr","10",["0","0","0",null],"60","S"],["1950","only","-","Apr","19",["0","0","0",null],"60","S"],["1951","only","-","Apr","22",["0","0","0",null],"60","S"],["1951","only","-","Oct","8",["0","0","0",null],"0","-"],["1962","only","-","Jul","15",["0","0","0",null],"60","S"],["1962","only","-","Oct","8",["0","0","0",null],"0","-"],["1964","only","-","May","15",["0","0","0",null],"60","S"],["1964","only","-","Oct","1",["0","0","0",null],"0","-"],["1970","1972","-","May","Sun>=2",["0","0","0",null],"60","S"],["1970","1972","-","Oct","Sun>=2",["0","0","0",null],"0","-"],["1973","only","-","Jun","3",["1","0","0",null],"60","S"],["1973","only","-","Nov","4",["3","0","0",null],"0","-"],["1974","only","-","Mar","31",["2","0","0",null],"60","S"],["1974","only","-","Nov","3",["5","0","0",null],"0","-"],["1975","only","-","Mar","30",["0","0","0",null],"60","S"],["1975","1976","-","Oct","lastSun",["0","0","0",null],"0","-"],["1976","only","-","Jun","1",["0","0","0",null],"60","S"],["1977","1978","-","Apr","Sun>=1",["0","0","0",null],"60","S"],["1977","only","-","Oct","16",["0","0","0",null],"0","-"],["1979","1980","-","Apr","Sun>=1",["3","0","0",null],"60","S"],["1979","1982","-","Oct","Mon>=11",["0","0","0",null],"0","-"],["1981","1982","-","Mar","lastSun",["3","0","0",null],"60","S"],["1983","only","-","Jul","31",["0","0","0",null],"60","S"],["1983","only","-","Oct","2",["0","0","0",null],"0","-"],["1985","only","-","Apr","20",["0","0","0",null],"60","S"],["1985","only","-","Sep","28",["0","0","0",null],"0","-"],["1986","1993","-","Mar","lastSun",["1","0","0","s"],"60","S"],["1986","1995","-","Sep","lastSun",["1","0","0","s"],"0","-"],["1994","only","-","Mar","20",["1","0","0","s"],"60","S"],["1995","2006","-","Mar","lastSun",["1","0","0","s"],"60","S"],["1996","2006","-","Oct","lastSun",["1","0","0","s"],"0","-"]],"US":[["1918","1919","-","Mar","lastSun",["2","0","0",null],"60","D"],["1918","1919","-","Oct","lastSun",["2","0","0",null],"0","S"],["1942","only","-","Feb","9",["2","0","0",null],"60","W",""],["1945","only","-","Aug","14",["23","0","0","u"],"60","P",""],["1945","only","-","Sep","lastSun",["2","0","0",null],"0","S"],["1967","2006","-","Oct","lastSun",["2","0","0",null],"0","S"],["1967","1973","-","Apr","lastSun",["2","0","0",null],"60","D"],["1974","only","-","Jan","6",["2","0","0",null],"60","D"],["1975","only","-","Feb","23",["2","0","0",null],"60","D"],["1976","1986","-","Apr","lastSun",["2","0","0",null],"60","D"],["1987","2006","-","Apr","Sun>=1",["2","0","0",null],"60","D"],["2007","max","-","Mar","Sun>=8",["2","0","0",null],"60","D"],["2007","max","-","Nov","Sun>=1",["2","0","0",null],"0","S"]],"NYC":[["1920","only","-","Mar","lastSun",["2","0","0",null],"60","D"],["1920","only","-","Oct","lastSun",["2","0","0",null],"0","S"],["1921","1966","-","Apr","lastSun",["2","0","0",null],"60","D"],["1921","1954","-","Sep","lastSun",["2","0","0",null],"0","S"],["1955","1966","-","Oct","lastSun",["2","0","0",null],"0","S"]],"Chicago":[["1920","only","-","Jun","13",["2","0","0",null],"60","D"],["1920","1921","-","Oct","lastSun",["2","0","0",null],"0","S"],["1921","only","-","Mar","lastSun",["2","0","0",null],"60","D"],["1922","1966","-","Apr","lastSun",["2","0","0",null],"60","D"],["1922","1954","-","Sep","lastSun",["2","0","0",null],"0","S"],["1955","1966","-","Oct","lastSun",["2","0","0",null],"0","S"]],"Denver":[["1920","1921","-","Mar","lastSun",["2","0","0",null],"60","D"],["1920","only","-","Oct","lastSun",["2","0","0",null],"0","S"],["1921","only","-","May","22",["2","0","0",null],"0","S"],["1965","1966","-","Apr","lastSun",["2","0","0",null],"60","D"],["1965","1966","-","Oct","lastSun",["2","0","0",null],"0","S"]],"CA":[["1948","only","-","Mar","14",["2","1","0",null],"60","D"],["1949","only","-","Jan","1",["2","0","0",null],"0","S"],["1950","1966","-","Apr","lastSun",["1","0","0",null],"60","D"],["1950","1961","-","Sep","lastSun",["2","0","0",null],"0","S"],["1962","1966","-","Oct","lastSun",["2","0","0",null],"0","S"]],"Indianapolis":[["1941","only","-","Jun","22",["2","0","0",null],"60","D"],["1941","1954","-","Sep","lastSun",["2","0","0",null],"0","S"],["1946","1954","-","Apr","lastSun",["2","0","0",null],"60","D"]],"Marengo":[["1951","only","-","Apr","lastSun",["2","0","0",null],"60","D"],["1951","only","-","Sep","lastSun",["2","0","0",null],"0","S"],["1954","1960","-","Apr","lastSun",["2","0","0",null],"60","D"],["1954","1960","-","Sep","lastSun",["2","0","0",null],"0","S"]],"Vincennes":[["1946","only","-","Apr","lastSun",["2","0","0",null],"60","D"],["1946","only","-","Sep","lastSun",["2","0","0",null],"0","S"],["1953","1954","-","Apr","lastSun",["2","0","0",null],"60","D"],["1953","1959","-","Sep","lastSun",["2","0","0",null],"0","S"],["1955","only","-","May","1",["0","0","0",null],"60","D"],["1956","1963","-","Apr","lastSun",["2","0","0",null],"60","D"],["1960","only","-","Oct","lastSun",["2","0","0",null],"0","S"],["1961","only","-","Sep","lastSun",["2","0","0",null],"0","S"],["1962","1963","-","Oct","lastSun",["2","0","0",null],"0","S"]],"Perry":[["1946","only","-","Apr","lastSun",["2","0","0",null],"60","D"],["1946","only","-","Sep","lastSun",["2","0","0",null],"0","S"],["1953","1954","-","Apr","lastSun",["2","0","0",null],"60","D"],["1953","1959","-","Sep","lastSun",["2","0","0",null],"0","S"],["1955","only","-","May","1",["0","0","0",null],"60","D"],["1956","1963","-","Apr","lastSun",["2","0","0",null],"60","D"],["1960","only","-","Oct","lastSun",["2","0","0",null],"0","S"],["1961","only","-","Sep","lastSun",["2","0","0",null],"0","S"],["1962","1963","-","Oct","lastSun",["2","0","0",null],"0","S"]],"Pike":[["1955","only","-","May","1",["0","0","0",null],"60","D"],["1955","1960","-","Sep","lastSun",["2","0","0",null],"0","S"],["1956","1964","-","Apr","lastSun",["2","0","0",null],"60","D"],["1961","1964","-","Oct","lastSun",["2","0","0",null],"0","S"]],"Starke":[["1947","1961","-","Apr","lastSun",["2","0","0",null],"60","D"],["1947","1954","-","Sep","lastSun",["2","0","0",null],"0","S"],["1955","1956","-","Oct","lastSun",["2","0","0",null],"0","S"],["1957","1958","-","Sep","lastSun",["2","0","0",null],"0","S"],["1959","1961","-","Oct","lastSun",["2","0","0",null],"0","S"]],"Pulaski":[["1946","1960","-","Apr","lastSun",["2","0","0",null],"60","D"],["1946","1954","-","Sep","lastSun",["2","0","0",null],"0","S"],["1955","1956","-","Oct","lastSun",["2","0","0",null],"0","S"],["1957","1960","-","Sep","lastSun",["2","0","0",null],"0","S"]],"Louisville":[["1921","only","-","May","1",["2","0","0",null],"60","D"],["1921","only","-","Sep","1",["2","0","0",null],"0","S"],["1941","1961","-","Apr","lastSun",["2","0","0",null],"60","D"],["1941","only","-","Sep","lastSun",["2","0","0",null],"0","S"],["1946","only","-","Jun","2",["2","0","0",null],"0","S"],["1950","1955","-","Sep","lastSun",["2","0","0",null],"0","S"],["1956","1960","-","Oct","lastSun",["2","0","0",null],"0","S"]],"Detroit":[["1948","only","-","Apr","lastSun",["2","0","0",null],"60","D"],["1948","only","-","Sep","lastSun",["2","0","0",null],"0","S"]],"Menominee":[["1946","only","-","Apr","lastSun",["2","0","0",null],"60","D"],["1946","only","-","Sep","lastSun",["2","0","0",null],"0","S"],["1966","only","-","Apr","lastSun",["2","0","0",null],"60","D"],["1966","only","-","Oct","lastSun",["2","0","0",null],"0","S"]],"Canada":[["1918","only","-","Apr","14",["2","0","0",null],"60","D"],["1918","only","-","Oct","27",["2","0","0",null],"0","S"],["1942","only","-","Feb","9",["2","0","0",null],"60","W",""],["1945","only","-","Aug","14",["23","0","0","u"],"60","P",""],["1945","only","-","Sep","30",["2","0","0",null],"0","S"],["1974","1986","-","Apr","lastSun",["2","0","0",null],"60","D"],["1974","2006","-","Oct","lastSun",["2","0","0",null],"0","S"],["1987","2006","-","Apr","Sun>=1",["2","0","0",null],"60","D"],["2007","max","-","Mar","Sun>=8",["2","0","0",null],"60","D"],["2007","max","-","Nov","Sun>=1",["2","0","0",null],"0","S"]],"StJohns":[["1917","only","-","Apr","8",["2","0","0",null],"60","D"],["1917","only","-","Sep","17",["2","0","0",null],"0","S"],["1919","only","-","May","5",["23","0","0",null],"60","D"],["1919","only","-","Aug","12",["23","0","0",null],"0","S"],["1920","1935","-","May","Sun>=1",["23","0","0",null],"60","D"],["1920","1935","-","Oct","lastSun",["23","0","0",null],"0","S"],["1936","1941","-","May","Mon>=9",["0","0","0",null],"60","D"],["1936","1941","-","Oct","Mon>=2",["0","0","0",null],"0","S"],["1946","1950","-","May","Sun>=8",["2","0","0",null],"60","D"],["1946","1950","-","Oct","Sun>=2",["2","0","0",null],"0","S"],["1951","1986","-","Apr","lastSun",["2","0","0",null],"60","D"],["1951","1959","-","Sep","lastSun",["2","0","0",null],"0","S"],["1960","1986","-","Oct","lastSun",["2","0","0",null],"0","S"],["1987","only","-","Apr","Sun>=1",["0","1","0",null],"60","D"],["1987","2006","-","Oct","lastSun",["0","1","0",null],"0","S"],["1988","only","-","Apr","Sun>=1",["0","1","0",null],"120","DD"],["1989","2006","-","Apr","Sun>=1",["0","1","0",null],"60","D"],["2007","2011","-","Mar","Sun>=8",["0","1","0",null],"60","D"],["2007","2010","-","Nov","Sun>=1",["0","1","0",null],"0","S"]],"Halifax":[["1916","only","-","Apr","1",["0","0","0",null],"60","D"],["1916","only","-","Oct","1",["0","0","0",null],"0","S"],["1920","only","-","May","9",["0","0","0",null],"60","D"],["1920","only","-","Aug","29",["0","0","0",null],"0","S"],["1921","only","-","May","6",["0","0","0",null],"60","D"],["1921","1922","-","Sep","5",["0","0","0",null],"0","S"],["1922","only","-","Apr","30",["0","0","0",null],"60","D"],["1923","1925","-","May","Sun>=1",["0","0","0",null],"60","D"],["1923","only","-","Sep","4",["0","0","0",null],"0","S"],["1924","only","-","Sep","15",["0","0","0",null],"0","S"],["1925","only","-","Sep","28",["0","0","0",null],"0","S"],["1926","only","-","May","16",["0","0","0",null],"60","D"],["1926","only","-","Sep","13",["0","0","0",null],"0","S"],["1927","only","-","May","1",["0","0","0",null],"60","D"],["1927","only","-","Sep","26",["0","0","0",null],"0","S"],["1928","1931","-","May","Sun>=8",["0","0","0",null],"60","D"],["1928","only","-","Sep","9",["0","0","0",null],"0","S"],["1929","only","-","Sep","3",["0","0","0",null],"0","S"],["1930","only","-","Sep","15",["0","0","0",null],"0","S"],["1931","1932","-","Sep","Mon>=24",["0","0","0",null],"0","S"],["1932","only","-","May","1",["0","0","0",null],"60","D"],["1933","only","-","Apr","30",["0","0","0",null],"60","D"],["1933","only","-","Oct","2",["0","0","0",null],"0","S"],["1934","only","-","May","20",["0","0","0",null],"60","D"],["1934","only","-","Sep","16",["0","0","0",null],"0","S"],["1935","only","-","Jun","2",["0","0","0",null],"60","D"],["1935","only","-","Sep","30",["0","0","0",null],"0","S"],["1936","only","-","Jun","1",["0","0","0",null],"60","D"],["1936","only","-","Sep","14",["0","0","0",null],"0","S"],["1937","1938","-","May","Sun>=1",["0","0","0",null],"60","D"],["1937","1941","-","Sep","Mon>=24",["0","0","0",null],"0","S"],["1939","only","-","May","28",["0","0","0",null],"60","D"],["1940","1941","-","May","Sun>=1",["0","0","0",null],"60","D"],["1946","1949","-","Apr","lastSun",["2","0","0",null],"60","D"],["1946","1949","-","Sep","lastSun",["2","0","0",null],"0","S"],["1951","1954","-","Apr","lastSun",["2","0","0",null],"60","D"],["1951","1954","-","Sep","lastSun",["2","0","0",null],"0","S"],["1956","1959","-","Apr","lastSun",["2","0","0",null],"60","D"],["1956","1959","-","Sep","lastSun",["2","0","0",null],"0","S"],["1962","1973","-","Apr","lastSun",["2","0","0",null],"60","D"],["1962","1973","-","Oct","lastSun",["2","0","0",null],"0","S"]],"Moncton":[["1933","1935","-","Jun","Sun>=8",["1","0","0",null],"60","D"],["1933","1935","-","Sep","Sun>=8",["1","0","0",null],"0","S"],["1936","1938","-","Jun","Sun>=1",["1","0","0",null],"60","D"],["1936","1938","-","Sep","Sun>=1",["1","0","0",null],"0","S"],["1939","only","-","May","27",["1","0","0",null],"60","D"],["1939","1941","-","Sep","Sat>=21",["1","0","0",null],"0","S"],["1940","only","-","May","19",["1","0","0",null],"60","D"],["1941","only","-","May","4",["1","0","0",null],"60","D"],["1946","1972","-","Apr","lastSun",["2","0","0",null],"60","D"],["1946","1956","-","Sep","lastSun",["2","0","0",null],"0","S"],["1957","1972","-","Oct","lastSun",["2","0","0",null],"0","S"],["1993","2006","-","Apr","Sun>=1",["0","1","0",null],"60","D"],["1993","2006","-","Oct","lastSun",["0","1","0",null],"0","S"]],"Toronto":[["1919","only","-","Mar","30",["23","30","0",null],"60","D"],["1919","only","-","Oct","26",["0","0","0",null],"0","S"],["1920","only","-","May","2",["2","0","0",null],"60","D"],["1920","only","-","Sep","26",["0","0","0",null],"0","S"],["1921","only","-","May","15",["2","0","0",null],"60","D"],["1921","only","-","Sep","15",["2","0","0",null],"0","S"],["1922","1923","-","May","Sun>=8",["2","0","0",null],"60","D"],["1922","1926","-","Sep","Sun>=15",["2","0","0",null],"0","S"],["1924","1927","-","May","Sun>=1",["2","0","0",null],"60","D"],["1927","1932","-","Sep","lastSun",["2","0","0",null],"0","S"],["1928","1931","-","Apr","lastSun",["2","0","0",null],"60","D"],["1932","only","-","May","1",["2","0","0",null],"60","D"],["1933","1940","-","Apr","lastSun",["2","0","0",null],"60","D"],["1933","only","-","Oct","1",["2","0","0",null],"0","S"],["1934","1939","-","Sep","lastSun",["2","0","0",null],"0","S"],["1945","1946","-","Sep","lastSun",["2","0","0",null],"0","S"],["1946","only","-","Apr","lastSun",["2","0","0",null],"60","D"],["1947","1949","-","Apr","lastSun",["0","0","0",null],"60","D"],["1947","1948","-","Sep","lastSun",["0","0","0",null],"0","S"],["1949","only","-","Nov","lastSun",["0","0","0",null],"0","S"],["1950","1973","-","Apr","lastSun",["2","0","0",null],"60","D"],["1950","only","-","Nov","lastSun",["2","0","0",null],"0","S"],["1951","1956","-","Sep","lastSun",["2","0","0",null],"0","S"],["1957","1973","-","Oct","lastSun",["2","0","0",null],"0","S"]],"Winn":[["1916","only","-","Apr","23",["0","0","0",null],"60","D"],["1916","only","-","Sep","17",["0","0","0",null],"0","S"],["1918","only","-","Apr","14",["2","0","0",null],"60","D"],["1918","only","-","Oct","27",["2","0","0",null],"0","S"],["1937","only","-","May","16",["2","0","0",null],"60","D"],["1937","only","-","Sep","26",["2","0","0",null],"0","S"],["1942","only","-","Feb","9",["2","0","0",null],"60","W",""],["1945","only","-","Aug","14",["23","0","0","u"],"60","P",""],["1945","only","-","Sep","lastSun",["2","0","0",null],"0","S"],["1946","only","-","May","12",["2","0","0",null],"60","D"],["1946","only","-","Oct","13",["2","0","0",null],"0","S"],["1947","1949","-","Apr","lastSun",["2","0","0",null],"60","D"],["1947","1949","-","Sep","lastSun",["2","0","0",null],"0","S"],["1950","only","-","May","1",["2","0","0",null],"60","D"],["1950","only","-","Sep","30",["2","0","0",null],"0","S"],["1951","1960","-","Apr","lastSun",["2","0","0",null],"60","D"],["1951","1958","-","Sep","lastSun",["2","0","0",null],"0","S"],["1959","only","-","Oct","lastSun",["2","0","0",null],"0","S"],["1960","only","-","Sep","lastSun",["2","0","0",null],"0","S"],["1963","only","-","Apr","lastSun",["2","0","0",null],"60","D"],["1963","only","-","Sep","22",["2","0","0",null],"0","S"],["1966","1986","-","Apr","lastSun",["2","0","0","s"],"60","D"],["1966","2005","-","Oct","lastSun",["2","0","0","s"],"0","S"],["1987","2005","-","Apr","Sun>=1",["2","0","0","s"],"60","D"]],"Regina":[["1918","only","-","Apr","14",["2","0","0",null],"60","D"],["1918","only","-","Oct","27",["2","0","0",null],"0","S"],["1930","1934","-","May","Sun>=1",["0","0","0",null],"60","D"],["1930","1934","-","Oct","Sun>=1",["0","0","0",null],"0","S"],["1937","1941","-","Apr","Sun>=8",["0","0","0",null],"60","D"],["1937","only","-","Oct","Sun>=8",["0","0","0",null],"0","S"],["1938","only","-","Oct","Sun>=1",["0","0","0",null],"0","S"],["1939","1941","-","Oct","Sun>=8",["0","0","0",null],"0","S"],["1942","only","-","Feb","9",["2","0","0",null],"60","W",""],["1945","only","-","Aug","14",["23","0","0","u"],"60","P",""],["1945","only","-","Sep","lastSun",["2","0","0",null],"0","S"],["1946","only","-","Apr","Sun>=8",["2","0","0",null],"60","D"],["1946","only","-","Oct","Sun>=8",["2","0","0",null],"0","S"],["1947","1957","-","Apr","lastSun",["2","0","0",null],"60","D"],["1947","1957","-","Sep","lastSun",["2","0","0",null],"0","S"],["1959","only","-","Apr","lastSun",["2","0","0",null],"60","D"],["1959","only","-","Oct","lastSun",["2","0","0",null],"0","S"]],"Swift":[["1957","only","-","Apr","lastSun",["2","0","0",null],"60","D"],["1957","only","-","Oct","lastSun",["2","0","0",null],"0","S"],["1959","1961","-","Apr","lastSun",["2","0","0",null],"60","D"],["1959","only","-","Oct","lastSun",["2","0","0",null],"0","S"],["1960","1961","-","Sep","lastSun",["2","0","0",null],"0","S"]],"Edm":[["1918","1919","-","Apr","Sun>=8",["2","0","0",null],"60","D"],["1918","only","-","Oct","27",["2","0","0",null],"0","S"],["1919","only","-","May","27",["2","0","0",null],"0","S"],["1920","1923","-","Apr","lastSun",["2","0","0",null],"60","D"],["1920","only","-","Oct","lastSun",["2","0","0",null],"0","S"],["1921","1923","-","Sep","lastSun",["2","0","0",null],"0","S"],["1942","only","-","Feb","9",["2","0","0",null],"60","W",""],["1945","only","-","Aug","14",["23","0","0","u"],"60","P",""],["1945","only","-","Sep","lastSun",["2","0","0",null],"0","S"],["1947","only","-","Apr","lastSun",["2","0","0",null],"60","D"],["1947","only","-","Sep","lastSun",["2","0","0",null],"0","S"],["1967","only","-","Apr","lastSun",["2","0","0",null],"60","D"],["1967","only","-","Oct","lastSun",["2","0","0",null],"0","S"],["1969","only","-","Apr","lastSun",["2","0","0",null],"60","D"],["1969","only","-","Oct","lastSun",["2","0","0",null],"0","S"],["1972","1986","-","Apr","lastSun",["2","0","0",null],"60","D"],["1972","2006","-","Oct","lastSun",["2","0","0",null],"0","S"]],"Vanc":[["1918","only","-","Apr","14",["2","0","0",null],"60","D"],["1918","only","-","Oct","27",["2","0","0",null],"0","S"],["1942","only","-","Feb","9",["2","0","0",null],"60","W",""],["1945","only","-","Aug","14",["23","0","0","u"],"60","P",""],["1945","only","-","Sep","30",["2","0","0",null],"0","S"],["1946","1986","-","Apr","lastSun",["2","0","0",null],"60","D"],["1946","only","-","Oct","13",["2","0","0",null],"0","S"],["1947","1961","-","Sep","lastSun",["2","0","0",null],"0","S"],["1962","2006","-","Oct","lastSun",["2","0","0",null],"0","S"]],"NT_YK":[["1918","only","-","Apr","14",["2","0","0",null],"60","D"],["1918","only","-","Oct","27",["2","0","0",null],"0","S"],["1919","only","-","May","25",["2","0","0",null],"60","D"],["1919","only","-","Nov","1",["0","0","0",null],"0","S"],["1942","only","-","Feb","9",["2","0","0",null],"60","W",""],["1945","only","-","Aug","14",["23","0","0","u"],"60","P",""],["1945","only","-","Sep","30",["2","0","0",null],"0","S"],["1965","only","-","Apr","lastSun",["0","0","0",null],"120","DD"],["1965","only","-","Oct","lastSun",["2","0","0",null],"0","S"],["1980","1986","-","Apr","lastSun",["2","0","0",null],"60","D"],["1980","2006","-","Oct","lastSun",["2","0","0",null],"0","S"],["1987","2006","-","Apr","Sun>=1",["2","0","0",null],"60","D"]],"Mexico":[["1939","only","-","Feb","5",["0","0","0",null],"60","D"],["1939","only","-","Jun","25",["0","0","0",null],"0","S"],["1940","only","-","Dec","9",["0","0","0",null],"60","D"],["1941","only","-","Apr","1",["0","0","0",null],"0","S"],["1943","only","-","Dec","16",["0","0","0",null],"60","W",""],["1944","only","-","May","1",["0","0","0",null],"0","S"],["1950","only","-","Feb","12",["0","0","0",null],"60","D"],["1950","only","-","Jul","30",["0","0","0",null],"0","S"],["1996","2000","-","Apr","Sun>=1",["2","0","0",null],"60","D"],["1996","2000","-","Oct","lastSun",["2","0","0",null],"0","S"],["2001","only","-","May","Sun>=1",["2","0","0",null],"60","D"],["2001","only","-","Sep","lastSun",["2","0","0",null],"0","S"],["2002","max","-","Apr","Sun>=1",["2","0","0",null],"60","D"],["2002","max","-","Oct","lastSun",["2","0","0",null],"0","S"]],"Bahamas":[["1964","1975","-","Oct","lastSun",["2","0","0",null],"0","S"],["1964","1975","-","Apr","lastSun",["2","0","0",null],"60","D"]],"Barb":[["1977","only","-","Jun","12",["2","0","0",null],"60","D"],["1977","1978","-","Oct","Sun>=1",["2","0","0",null],"0","S"],["1978","1980","-","Apr","Sun>=15",["2","0","0",null],"60","D"],["1979","only","-","Sep","30",["2","0","0",null],"0","S"],["1980","only","-","Sep","25",["2","0","0",null],"0","S"]],"Belize":[["1918","1942","-","Oct","Sun>=2",["0","0","0",null],"30","-0530"],["1919","1943","-","Feb","Sun>=9",["0","0","0",null],"0","CST"],["1973","only","-","Dec","5",["0","0","0",null],"60","CDT"],["1974","only","-","Feb","9",["0","0","0",null],"0","CST"],["1982","only","-","Dec","18",["0","0","0",null],"60","CDT"],["1983","only","-","Feb","12",["0","0","0",null],"0","CST"]],"CR":[["1979","1980","-","Feb","lastSun",["0","0","0",null],"60","D"],["1979","1980","-","Jun","Sun>=1",["0","0","0",null],"0","S"],["1991","1992","-","Jan","Sat>=15",["0","0","0",null],"60","D"],["1991","only","-","Jul","1",["0","0","0",null],"0","S"],["1992","only","-","Mar","15",["0","0","0",null],"0","S"]],"Cuba":[["1928","only","-","Jun","10",["0","0","0",null],"60","D"],["1928","only","-","Oct","10",["0","0","0",null],"0","S"],["1940","1942","-","Jun","Sun>=1",["0","0","0",null],"60","D"],["1940","1942","-","Sep","Sun>=1",["0","0","0",null],"0","S"],["1945","1946","-","Jun","Sun>=1",["0","0","0",null],"60","D"],["1945","1946","-","Sep","Sun>=1",["0","0","0",null],"0","S"],["1965","only","-","Jun","1",["0","0","0",null],"60","D"],["1965","only","-","Sep","30",["0","0","0",null],"0","S"],["1966","only","-","May","29",["0","0","0",null],"60","D"],["1966","only","-","Oct","2",["0","0","0",null],"0","S"],["1967","only","-","Apr","8",["0","0","0",null],"60","D"],["1967","1968","-","Sep","Sun>=8",["0","0","0",null],"0","S"],["1968","only","-","Apr","14",["0","0","0",null],"60","D"],["1969","1977","-","Apr","lastSun",["0","0","0",null],"60","D"],["1969","1971","-","Oct","lastSun",["0","0","0",null],"0","S"],["1972","1974","-","Oct","8",["0","0","0",null],"0","S"],["1975","1977","-","Oct","lastSun",["0","0","0",null],"0","S"],["1978","only","-","May","7",["0","0","0",null],"60","D"],["1978","1990","-","Oct","Sun>=8",["0","0","0",null],"0","S"],["1979","1980","-","Mar","Sun>=15",["0","0","0",null],"60","D"],["1981","1985","-","May","Sun>=5",["0","0","0",null],"60","D"],["1986","1989","-","Mar","Sun>=14",["0","0","0",null],"60","D"],["1990","1997","-","Apr","Sun>=1",["0","0","0",null],"60","D"],["1991","1995","-","Oct","Sun>=8",["0","0","0","s"],"0","S"],["1996","only","-","Oct","6",["0","0","0","s"],"0","S"],["1997","only","-","Oct","12",["0","0","0","s"],"0","S"],["1998","1999","-","Mar","lastSun",["0","0","0","s"],"60","D"],["1998","2003","-","Oct","lastSun",["0","0","0","s"],"0","S"],["2000","2003","-","Apr","Sun>=1",["0","0","0","s"],"60","D"],["2004","only","-","Mar","lastSun",["0","0","0","s"],"60","D"],["2006","2010","-","Oct","lastSun",["0","0","0","s"],"0","S"],["2007","only","-","Mar","Sun>=8",["0","0","0","s"],"60","D"],["2008","only","-","Mar","Sun>=15",["0","0","0","s"],"60","D"],["2009","2010","-","Mar","Sun>=8",["0","0","0","s"],"60","D"],["2011","only","-","Mar","Sun>=15",["0","0","0","s"],"60","D"],["2011","only","-","Nov","13",["0","0","0","s"],"0","S"],["2012","only","-","Apr","1",["0","0","0","s"],"60","D"],["2012","max","-","Nov","Sun>=1",["0","0","0","s"],"0","S"],["2013","max","-","Mar","Sun>=8",["0","0","0","s"],"60","D"]],"DR":[["1966","only","-","Oct","30",["0","0","0",null],"60","EDT"],["1967","only","-","Feb","28",["0","0","0",null],"0","EST"],["1969","1973","-","Oct","lastSun",["0","0","0",null],"30","-0430"],["1970","only","-","Feb","21",["0","0","0",null],"0","EST"],["1971","only","-","Jan","20",["0","0","0",null],"0","EST"],["1972","1974","-","Jan","21",["0","0","0",null],"0","EST"]],"Salv":[["1987","1988","-","May","Sun>=1",["0","0","0",null],"60","D"],["1987","1988","-","Sep","lastSun",["0","0","0",null],"0","S"]],"Guat":[["1973","only","-","Nov","25",["0","0","0",null],"60","D"],["1974","only","-","Feb","24",["0","0","0",null],"0","S"],["1983","only","-","May","21",["0","0","0",null],"60","D"],["1983","only","-","Sep","22",["0","0","0",null],"0","S"],["1991","only","-","Mar","23",["0","0","0",null],"60","D"],["1991","only","-","Sep","7",["0","0","0",null],"0","S"],["2006","only","-","Apr","30",["0","0","0",null],"60","D"],["2006","only","-","Oct","1",["0","0","0",null],"0","S"]],"Haiti":[["1983","only","-","May","8",["0","0","0",null],"60","D"],["1984","1987","-","Apr","lastSun",["0","0","0",null],"60","D"],["1983","1987","-","Oct","lastSun",["0","0","0",null],"0","S"],["1988","1997","-","Apr","Sun>=1",["1","0","0","s"],"60","D"],["1988","1997","-","Oct","lastSun",["1","0","0","s"],"0","S"],["2005","2006","-","Apr","Sun>=1",["0","0","0",null],"60","D"],["2005","2006","-","Oct","lastSun",["0","0","0",null],"0","S"],["2012","2015","-","Mar","Sun>=8",["2","0","0",null],"60","D"],["2012","2015","-","Nov","Sun>=1",["2","0","0",null],"0","S"],["2017","max","-","Mar","Sun>=8",["2","0","0",null],"60","D"],["2017","max","-","Nov","Sun>=1",["2","0","0",null],"0","S"]],"Hond":[["1987","1988","-","May","Sun>=1",["0","0","0",null],"60","D"],["1987","1988","-","Sep","lastSun",["0","0","0",null],"0","S"],["2006","only","-","May","Sun>=1",["0","0","0",null],"60","D"],["2006","only","-","Aug","Mon>=1",["0","0","0",null],"0","S"]],"Nic":[["1979","1980","-","Mar","Sun>=16",["0","0","0",null],"60","D"],["1979","1980","-","Jun","Mon>=23",["0","0","0",null],"0","S"],["2005","only","-","Apr","10",["0","0","0",null],"60","D"],["2005","only","-","Oct","Sun>=1",["0","0","0",null],"0","S"],["2006","only","-","Apr","30",["2","0","0",null],"60","D"],["2006","only","-","Oct","Sun>=1",["1","0","0",null],"0","S"]],"Arg":[["1930","only","-","Dec","1",["0","0","0",null],"60","S"],["1931","only","-","Apr","1",["0","0","0",null],"0","-"],["1931","only","-","Oct","15",["0","0","0",null],"60","S"],["1932","1940","-","Mar","1",["0","0","0",null],"0","-"],["1932","1939","-","Nov","1",["0","0","0",null],"60","S"],["1940","only","-","Jul","1",["0","0","0",null],"60","S"],["1941","only","-","Jun","15",["0","0","0",null],"0","-"],["1941","only","-","Oct","15",["0","0","0",null],"60","S"],["1943","only","-","Aug","1",["0","0","0",null],"0","-"],["1943","only","-","Oct","15",["0","0","0",null],"60","S"],["1946","only","-","Mar","1",["0","0","0",null],"0","-"],["1946","only","-","Oct","1",["0","0","0",null],"60","S"],["1963","only","-","Oct","1",["0","0","0",null],"0","-"],["1963","only","-","Dec","15",["0","0","0",null],"60","S"],["1964","1966","-","Mar","1",["0","0","0",null],"0","-"],["1964","1966","-","Oct","15",["0","0","0",null],"60","S"],["1967","only","-","Apr","2",["0","0","0",null],"0","-"],["1967","1968","-","Oct","Sun>=1",["0","0","0",null],"60","S"],["1968","1969","-","Apr","Sun>=1",["0","0","0",null],"0","-"],["1974","only","-","Jan","23",["0","0","0",null],"60","S"],["1974","only","-","May","1",["0","0","0",null],"0","-"],["1988","only","-","Dec","1",["0","0","0",null],"60","S"],["1989","1993","-","Mar","Sun>=1",["0","0","0",null],"0","-"],["1989","1992","-","Oct","Sun>=15",["0","0","0",null],"60","S"],["1999","only","-","Oct","Sun>=1",["0","0","0",null],"60","S"],["2000","only","-","Mar","3",["0","0","0",null],"0","-"],["2007","only","-","Dec","30",["0","0","0",null],"60","S"],["2008","2009","-","Mar","Sun>=15",["0","0","0",null],"0","-"],["2008","only","-","Oct","Sun>=15",["0","0","0",null],"60","S"]],"SanLuis":[["2008","2009","-","Mar","Sun>=8",["0","0","0",null],"0","-"],["2007","2008","-","Oct","Sun>=8",["0","0","0",null],"60","S"]],"Brazil":[["1931","only","-","Oct","3",["11","0","0",null],"60","S"],["1932","1933","-","Apr","1",["0","0","0",null],"0","-"],["1932","only","-","Oct","3",["0","0","0",null],"60","S"],["1949","1952","-","Dec","1",["0","0","0",null],"60","S"],["1950","only","-","Apr","16",["1","0","0",null],"0","-"],["1951","1952","-","Apr","1",["0","0","0",null],"0","-"],["1953","only","-","Mar","1",["0","0","0",null],"0","-"],["1963","only","-","Dec","9",["0","0","0",null],"60","S"],["1964","only","-","Mar","1",["0","0","0",null],"0","-"],["1965","only","-","Jan","31",["0","0","0",null],"60","S"],["1965","only","-","Mar","31",["0","0","0",null],"0","-"],["1965","only","-","Dec","1",["0","0","0",null],"60","S"],["1966","1968","-","Mar","1",["0","0","0",null],"0","-"],["1966","1967","-","Nov","1",["0","0","0",null],"60","S"],["1985","only","-","Nov","2",["0","0","0",null],"60","S"],["1986","only","-","Mar","15",["0","0","0",null],"0","-"],["1986","only","-","Oct","25",["0","0","0",null],"60","S"],["1987","only","-","Feb","14",["0","0","0",null],"0","-"],["1987","only","-","Oct","25",["0","0","0",null],"60","S"],["1988","only","-","Feb","7",["0","0","0",null],"0","-"],["1988","only","-","Oct","16",["0","0","0",null],"60","S"],["1989","only","-","Jan","29",["0","0","0",null],"0","-"],["1989","only","-","Oct","15",["0","0","0",null],"60","S"],["1990","only","-","Feb","11",["0","0","0",null],"0","-"],["1990","only","-","Oct","21",["0","0","0",null],"60","S"],["1991","only","-","Feb","17",["0","0","0",null],"0","-"],["1991","only","-","Oct","20",["0","0","0",null],"60","S"],["1992","only","-","Feb","9",["0","0","0",null],"0","-"],["1992","only","-","Oct","25",["0","0","0",null],"60","S"],["1993","only","-","Jan","31",["0","0","0",null],"0","-"],["1993","1995","-","Oct","Sun>=11",["0","0","0",null],"60","S"],["1994","1995","-","Feb","Sun>=15",["0","0","0",null],"0","-"],["1996","only","-","Feb","11",["0","0","0",null],"0","-"],["1996","only","-","Oct","6",["0","0","0",null],"60","S"],["1997","only","-","Feb","16",["0","0","0",null],"0","-"],["1997","only","-","Oct","6",["0","0","0",null],"60","S"],["1998","only","-","Mar","1",["0","0","0",null],"0","-"],["1998","only","-","Oct","11",["0","0","0",null],"60","S"],["1999","only","-","Feb","21",["0","0","0",null],"0","-"],["1999","only","-","Oct","3",["0","0","0",null],"60","S"],["2000","only","-","Feb","27",["0","0","0",null],"0","-"],["2000","2001","-","Oct","Sun>=8",["0","0","0",null],"60","S"],["2001","2006","-","Feb","Sun>=15",["0","0","0",null],"0","-"],["2002","only","-","Nov","3",["0","0","0",null],"60","S"],["2003","only","-","Oct","19",["0","0","0",null],"60","S"],["2004","only","-","Nov","2",["0","0","0",null],"60","S"],["2005","only","-","Oct","16",["0","0","0",null],"60","S"],["2006","only","-","Nov","5",["0","0","0",null],"60","S"],["2007","only","-","Feb","25",["0","0","0",null],"0","-"],["2007","only","-","Oct","Sun>=8",["0","0","0",null],"60","S"],["2008","2017","-","Oct","Sun>=15",["0","0","0",null],"60","S"],["2008","2011","-","Feb","Sun>=15",["0","0","0",null],"0","-"],["2012","only","-","Feb","Sun>=22",["0","0","0",null],"0","-"],["2013","2014","-","Feb","Sun>=15",["0","0","0",null],"0","-"],["2015","only","-","Feb","Sun>=22",["0","0","0",null],"0","-"],["2016","2022","-","Feb","Sun>=15",["0","0","0",null],"0","-"],["2018","max","-","Nov","Sun>=1",["0","0","0",null],"60","S"],["2023","only","-","Feb","Sun>=22",["0","0","0",null],"0","-"],["2024","2025","-","Feb","Sun>=15",["0","0","0",null],"0","-"],["2026","only","-","Feb","Sun>=22",["0","0","0",null],"0","-"],["2027","2033","-","Feb","Sun>=15",["0","0","0",null],"0","-"],["2034","only","-","Feb","Sun>=22",["0","0","0",null],"0","-"],["2035","2036","-","Feb","Sun>=15",["0","0","0",null],"0","-"],["2037","only","-","Feb","Sun>=22",["0","0","0",null],"0","-"],["2038","max","-","Feb","Sun>=15",["0","0","0",null],"0","-"]],"Chile":[["1927","1931","-","Sep","1",["0","0","0",null],"60","S"],["1928","1932","-","Apr","1",["0","0","0",null],"0","-"],["1968","only","-","Nov","3",["4","0","0","u"],"60","S"],["1969","only","-","Mar","30",["3","0","0","u"],"0","-"],["1969","only","-","Nov","23",["4","0","0","u"],"60","S"],["1970","only","-","Mar","29",["3","0","0","u"],"0","-"],["1971","only","-","Mar","14",["3","0","0","u"],"0","-"],["1970","1972","-","Oct","Sun>=9",["4","0","0","u"],"60","S"],["1972","1986","-","Mar","Sun>=9",["3","0","0","u"],"0","-"],["1973","only","-","Sep","30",["4","0","0","u"],"60","S"],["1974","1987","-","Oct","Sun>=9",["4","0","0","u"],"60","S"],["1987","only","-","Apr","12",["3","0","0","u"],"0","-"],["1988","1990","-","Mar","Sun>=9",["3","0","0","u"],"0","-"],["1988","1989","-","Oct","Sun>=9",["4","0","0","u"],"60","S"],["1990","only","-","Sep","16",["4","0","0","u"],"60","S"],["1991","1996","-","Mar","Sun>=9",["3","0","0","u"],"0","-"],["1991","1997","-","Oct","Sun>=9",["4","0","0","u"],"60","S"],["1997","only","-","Mar","30",["3","0","0","u"],"0","-"],["1998","only","-","Mar","Sun>=9",["3","0","0","u"],"0","-"],["1998","only","-","Sep","27",["4","0","0","u"],"60","S"],["1999","only","-","Apr","4",["3","0","0","u"],"0","-"],["1999","2010","-","Oct","Sun>=9",["4","0","0","u"],"60","S"],["2000","2007","-","Mar","Sun>=9",["3","0","0","u"],"0","-"],["2008","only","-","Mar","30",["3","0","0","u"],"0","-"],["2009","only","-","Mar","Sun>=9",["3","0","0","u"],"0","-"],["2010","only","-","Apr","Sun>=1",["3","0","0","u"],"0","-"],["2011","only","-","May","Sun>=2",["3","0","0","u"],"0","-"],["2011","only","-","Aug","Sun>=16",["4","0","0","u"],"60","S"],["2012","2014","-","Apr","Sun>=23",["3","0","0","u"],"0","-"],["2012","2014","-","Sep","Sun>=2",["4","0","0","u"],"60","S"],["2016","max","-","May","Sun>=9",["3","0","0","u"],"0","-"],["2016","max","-","Aug","Sun>=9",["4","0","0","u"],"60","S"]],"CO":[["1992","only","-","May","3",["0","0","0",null],"60","S"],["1993","only","-","Apr","4",["0","0","0",null],"0","-"]],"Ecuador":[["1992","only","-","Nov","28",["0","0","0",null],"60","S"],["1993","only","-","Feb","5",["0","0","0",null],"0","-"]],"Falk":[["1937","1938","-","Sep","lastSun",["0","0","0",null],"60","S"],["1938","1942","-","Mar","Sun>=19",["0","0","0",null],"0","-"],["1939","only","-","Oct","1",["0","0","0",null],"60","S"],["1940","1942","-","Sep","lastSun",["0","0","0",null],"60","S"],["1943","only","-","Jan","1",["0","0","0",null],"0","-"],["1983","only","-","Sep","lastSun",["0","0","0",null],"60","S"],["1984","1985","-","Apr","lastSun",["0","0","0",null],"0","-"],["1984","only","-","Sep","16",["0","0","0",null],"60","S"],["1985","2000","-","Sep","Sun>=9",["0","0","0",null],"60","S"],["1986","2000","-","Apr","Sun>=16",["0","0","0",null],"0","-"],["2001","2010","-","Apr","Sun>=15",["2","0","0",null],"0","-"],["2001","2010","-","Sep","Sun>=1",["2","0","0",null],"60","S"]],"Para":[["1975","1988","-","Oct","1",["0","0","0",null],"60","S"],["1975","1978","-","Mar","1",["0","0","0",null],"0","-"],["1979","1991","-","Apr","1",["0","0","0",null],"0","-"],["1989","only","-","Oct","22",["0","0","0",null],"60","S"],["1990","only","-","Oct","1",["0","0","0",null],"60","S"],["1991","only","-","Oct","6",["0","0","0",null],"60","S"],["1992","only","-","Mar","1",["0","0","0",null],"0","-"],["1992","only","-","Oct","5",["0","0","0",null],"60","S"],["1993","only","-","Mar","31",["0","0","0",null],"0","-"],["1993","1995","-","Oct","1",["0","0","0",null],"60","S"],["1994","1995","-","Feb","lastSun",["0","0","0",null],"0","-"],["1996","only","-","Mar","1",["0","0","0",null],"0","-"],["1996","2001","-","Oct","Sun>=1",["0","0","0",null],"60","S"],["1997","only","-","Feb","lastSun",["0","0","0",null],"0","-"],["1998","2001","-","Mar","Sun>=1",["0","0","0",null],"0","-"],["2002","2004","-","Apr","Sun>=1",["0","0","0",null],"0","-"],["2002","2003","-","Sep","Sun>=1",["0","0","0",null],"60","S"],["2004","2009","-","Oct","Sun>=15",["0","0","0",null],"60","S"],["2005","2009","-","Mar","Sun>=8",["0","0","0",null],"0","-"],["2010","max","-","Oct","Sun>=1",["0","0","0",null],"60","S"],["2010","2012","-","Apr","Sun>=8",["0","0","0",null],"0","-"],["2013","max","-","Mar","Sun>=22",["0","0","0",null],"0","-"]],"Peru":[["1938","only","-","Jan","1",["0","0","0",null],"60","S"],["1938","only","-","Apr","1",["0","0","0",null],"0","-"],["1938","1939","-","Sep","lastSun",["0","0","0",null],"60","S"],["1939","1940","-","Mar","Sun>=24",["0","0","0",null],"0","-"],["1986","1987","-","Jan","1",["0","0","0",null],"60","S"],["1986","1987","-","Apr","1",["0","0","0",null],"0","-"],["1990","only","-","Jan","1",["0","0","0",null],"60","S"],["1990","only","-","Apr","1",["0","0","0",null],"0","-"],["1994","only","-","Jan","1",["0","0","0",null],"60","S"],["1994","only","-","Apr","1",["0","0","0",null],"0","-"]],"Uruguay":[["1923","only","-","Oct","2",["0","0","0",null],"30","HS"],["1924","1926","-","Apr","1",["0","0","0",null],"0","-"],["1924","1925","-","Oct","1",["0","0","0",null],"30","HS"],["1933","1935","-","Oct","lastSun",["0","0","0",null],"30","HS"],["1934","1936","-","Mar","Sat>=25",["23","30","0","s"],"0","-"],["1936","only","-","Nov","1",["0","0","0",null],"30","HS"],["1937","1941","-","Mar","lastSun",["0","0","0",null],"0","-"],["1937","1940","-","Oct","lastSun",["0","0","0",null],"30","HS"],["1941","only","-","Aug","1",["0","0","0",null],"30","HS"],["1942","only","-","Jan","1",["0","0","0",null],"0","-"],["1942","only","-","Dec","14",["0","0","0",null],"60","S"],["1943","only","-","Mar","14",["0","0","0",null],"0","-"],["1959","only","-","May","24",["0","0","0",null],"60","S"],["1959","only","-","Nov","15",["0","0","0",null],"0","-"],["1960","only","-","Jan","17",["0","0","0",null],"60","S"],["1960","only","-","Mar","6",["0","0","0",null],"0","-"],["1965","1967","-","Apr","Sun>=1",["0","0","0",null],"60","S"],["1965","only","-","Sep","26",["0","0","0",null],"0","-"],["1966","1967","-","Oct","31",["0","0","0",null],"0","-"],["1968","1970","-","May","27",["0","0","0",null],"30","HS"],["1968","1970","-","Dec","2",["0","0","0",null],"0","-"],["1972","only","-","Apr","24",["0","0","0",null],"60","S"],["1972","only","-","Aug","15",["0","0","0",null],"0","-"],["1974","only","-","Mar","10",["0","0","0",null],"30","HS"],["1974","only","-","Dec","22",["0","0","0",null],"60","S"],["1976","only","-","Oct","1",["0","0","0",null],"0","-"],["1977","only","-","Dec","4",["0","0","0",null],"60","S"],["1978","only","-","Apr","1",["0","0","0",null],"0","-"],["1979","only","-","Oct","1",["0","0","0",null],"60","S"],["1980","only","-","May","1",["0","0","0",null],"0","-"],["1987","only","-","Dec","14",["0","0","0",null],"60","S"],["1988","only","-","Mar","14",["0","0","0",null],"0","-"],["1988","only","-","Dec","11",["0","0","0",null],"60","S"],["1989","only","-","Mar","12",["0","0","0",null],"0","-"],["1989","only","-","Oct","29",["0","0","0",null],"60","S"],["1990","1992","-","Mar","Sun>=1",["0","0","0",null],"0","-"],["1990","1991","-","Oct","Sun>=21",["0","0","0",null],"60","S"],["1992","only","-","Oct","18",["0","0","0",null],"60","S"],["1993","only","-","Feb","28",["0","0","0",null],"0","-"],["2004","only","-","Sep","19",["0","0","0",null],"60","S"],["2005","only","-","Mar","27",["2","0","0",null],"0","-"],["2005","only","-","Oct","9",["2","0","0",null],"60","S"],["2006","only","-","Mar","12",["2","0","0",null],"0","-"],["2006","2014","-","Oct","Sun>=1",["2","0","0",null],"60","S"],["2007","2015","-","Mar","Sun>=8",["2","0","0",null],"0","-"]],"SystemV":[["NaN","1973","-","Apr","lastSun",["2","0","0",null],"60","D"],["NaN","1973","-","Oct","lastSun",["2","0","0",null],"0","S"],["1974","only","-","Jan","6",["2","0","0",null],"60","D"],["1974","only","-","Nov","lastSun",["2","0","0",null],"0","S"],["1975","only","-","Feb","23",["2","0","0",null],"60","D"],["1975","only","-","Oct","lastSun",["2","0","0",null],"0","S"],["1976","max","-","Apr","lastSun",["2","0","0",null],"60","D"],["1976","max","-","Oct","lastSun",["2","0","0",null],"0","S"]]}}
},{}]},{},[1]);
