/**
 * This file contains message handlers allowing Misty to respond to queries
 * about the schedule of Astea Conference 2019: https://conference.astea.solutions/en
 * Responses are based on the intents and entities recognized by the corresponding
 * Wit.ai chatbot.
 */

const _ = require('lodash');
const moment = require('moment');
const scheduleJson = require('./schedule.json');
const schedule = scheduleJson.map((item, i) => ({
  ...item,
  start: moment(item.start, 'HH:mm'),
  end: moment(i + 1 < scheduleJson.length ? scheduleJson[i + 1].start : item.start, 'HH:mm'),
}));

const responses = {
  presentation: [
    event => `At ${event.start.format('HH:mm')} ${event.speaker} will talk about ${event.eventName}.`,
    event => `At ${event.start.format('HH:mm')} is "${event.eventName}" by ${event.speaker}.`,
    event => `The presentation "${event.eventName}" by ${event.speaker} starts at ${event.start.format('HH:mm')}.`,
    event => `${event.speaker} will talk about ${event.eventName} at ${event.start.format('HH:mm')}.`,
    event => `${event.speaker}'s presentation about ${event.eventName} starts at ${event.start.format('HH:mm')}.`,
  ],
  break: [
    event => `There's ${event.eventName} between ${event.start.format('HH:mm')} and ${event.end.format('HH:mm')}.`,
    event => `${event.eventName} starts at ${event.start.format('HH:mm')} and ends at ${event.end.format('HH:mm')}.`,
    event => `${event.eventName} is from ${event.start.format('HH:mm')} till ${event.end.format('HH:mm')}.`,
  ],
  event: [
    event => `The ${event.eventName} is at ${event.start.format('HH:mm')}!`,
    event => `The ${event.eventName} starts at ${event.start.format('HH:mm')}!`,
    event => `There's a ${event.eventName} at ${event.start.format('HH:mm')}!`,
    event => `At ${event.start.format('HH:mm')} there's a ${event.eventName}.`,
  ],
}

function handleEventQuery(wit) {
  if (!wit.entities.intent || wit.entities.intent[0].value !== 'event_query') {
    return null;
  }
}

function handleTimeQuery(wit) {
  if (!wit.entities.intent || wit.entities.intent[0].value !== 'time_query') {
    return null;
  }

  // Extract all known entities
  let relativeOrder = 'at';
  if (wit.entities.relative_order) {
    relativeOrder = wit.entities.relative_order[0].value;
  }

  let date = null;
  if (wit.entities.datetime) {
    const dateEntity = wit.entities.datetime[0];
    if (dateEntity.type === 'value') {
      date = moment(dateEntity.value);
    } else { // interval
      date = moment(dateEntity.from ? dateEntity.from.value : dateEntity.to.value);
      relativeOrder = dateEntity.from ? 'next' : 'previuos';
    }
    if (date.hours() <= 9) {
      date.add(12, 'hours');
    }
    if (date.hours() > 21) {
      date.subtract(12, 'hours');
    }
    date.date(moment().date());
  }

  const eventType = wit.entities.agenda_item ? wit.entities.agenda_item[0].value : null;
  const absoluteOrder = wit.entities.absolute_order ? wit.entities.absolute_order[0].value : null;

  const event = findEvent(absoluteOrder, relativeOrder, date, eventType);
  if (event) {
    const category = responses[event.eventType] || responses.event; 
    return _.sample(category)(event);
  }

  return null;
}

function findEvent(absoluteOrder, relativeOrder, date, eventType) {
  const matchingEvents = _.filter(schedule, event => matches(event, eventType));
  if (absoluteOrder === 'first') {
    return _.first(matchingEvents);
  }
  if (absoluteOrder === 'last') {
    return _.last(matchingEvents);
  }
  const anchorTime = date || moment();
  if (relativeOrder === 'next') {
    return _.find(matchingEvents, event => event.start.isSameOrAfter(anchorTime));
  }
  if (relativeOrder === 'previous') {
    return _.find(matchingEvents, event => event.start.isBefore(anchorTime));
  }
  const eventAtTime = _.findLast(schedule, event => event.start.isSameOrBefore(anchorTime));
  return matches(eventAtTime, eventType) ? eventAtTime : null;
}

function matches(event, eventType) {
  return !eventType || event.eventType === eventType;
}

module.exports = {
  handleEventQuery,
  handleTimeQuery,
}