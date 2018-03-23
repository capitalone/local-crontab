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
