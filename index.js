import { byFamily, rules } from './config.json';
import { msleep } from 'sleep';
import twilio from 'twilio';
import prompt from 'prompt';

const accountSid = 'ACc6120af44db66632b8cfde73d5025647';
const authToken = '37ba3a76fd909073b3c7a3f75489348e';
const client = new twilio(accountSid, authToken);

const people = Object.keys(byFamily)
  .reduce((accum, lastName) => {
    return [
      ...accum,
      ...byFamily[lastName].map(person => ({
        ...person,
        familyName: lastName,
        receive: false,
      }))
    ];
  }, []);

console.log(`Total people: ${people.length}`);

if (people.length % 2 !== 0) {
  throw 'There must be an even amount of people!'
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getRandomPerson(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function getEligiblePersons(familyName, blacklist) {
  return people.filter(person => person.familyName !== familyName && !person.receive);
}

function getByName(name) {
  return people.find(person => person.name === name);
}

function isMustNot(who, get) {
  const { must_not } = rules;
  return !!must_not.find(rule => rule.who === who && rule.get === get)
}

function getAssignments() {
  const assignments = [];
  Object.keys(byFamily).forEach(familyName => {
    const familyList = shuffle(byFamily[familyName]);
    familyList.forEach(person => {
      const restOfFamily = getEligiblePersons(familyName);
      if (restOfFamily.length === 0) {
        // console.log(`Unable to find match for ${person.name}`);
        throw 'Out of family!';
      }

      const giftReceiver = getRandomPerson(restOfFamily);
      if (isMustNot(person.name, giftReceiver.name)) {
        throw `Person not eligble`;
      }
      giftReceiver.receive = true;
      assignments.push([ person, giftReceiver ]);
    });
  });
  return assignments;
}

let assignments = [];
let attempts = 0;
while (attempts++ < 100) {
  console.log(`Attempt ${attempts}...`);
  try {
    assignments = getAssignments();
    break;
  }
  catch (e) {
    if (e != 'Out of family!' && e != 'Person not eligble') {
      throw e;
    }
    console.log(`Failed. Trying again...`);
    console.log(e);
    people.forEach(person => {
      person.receive = false;
    });
    msleep(1);
  }
}

console.log('---------');
console.log('Assignments:');
assignments.forEach(assignment => {
  console.log(`${assignment[0].name} -> ${assignment[1].name}`);
});

prompt.start();
prompt.get(['happy'], async (err, result) => {
  if (result.happy === 'y') {
    for (const assignment of assignments) {
      if (assignment[0].phone) {
        console.log(`Sending SMS to ${assignment[0].name} at ${assignment[0].phone}`);

        try {
          await client.messages.create({
            body: `Hello there. This is the super sweet automatic Secret Santa gift selection tool! You have been randomly assigned: ${assignment[1].name}`,
            to: `+1${assignment[0].phone}`,
            from: '+15853660186'
          });
        }
        catch (e) {
          console.log('error', e);
        }
      }
    }
  }
});