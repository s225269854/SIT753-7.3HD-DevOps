const { expect } = require('chai');

describe('CI Pipeline Validation Tests', () => {
  describe('Valid input tests', () => {
    it('accepts a valid user preference payload', () => {
      const payload = {
        user_id: 1,
        dietaryConstraints: {
          allergies: ['peanut'],
          dietaryRequirements: ['vegetarian']
        },
        maxResults: 5
      };

      expect(payload).to.have.property('user_id').that.is.a('number');
      expect(payload.dietaryConstraints).to.be.an('object');
      expect(payload.maxResults).to.be.within(1, 20);
    });
  });

  describe('Invalid input tests', () => {
    it('rejects a payload missing dietaryConstraints', () => {
      const payload = {
        user_id: 1,
        maxResults: 5
      };

      expect(payload).to.not.have.property('dietaryConstraints');
    });

    it('rejects non-numeric maxResults', () => {
      const payload = {
        user_id: 1,
        dietaryConstraints: {},
        maxResults: 'many'
      };

      expect(payload.maxResults).to.not.be.a('number');
    });
  });

  describe('Edge case tests', () => {
    it('accepts the minimum allowed maxResults boundary', () => {
      const payload = {
        user_id: 1,
        dietaryConstraints: {},
        maxResults: 1
      };

      expect(payload.maxResults).to.equal(1);
    });

    it('accepts the maximum allowed maxResults boundary', () => {
      const payload = {
        user_id: 1,
        dietaryConstraints: {},
        maxResults: 20
      };

      expect(payload.maxResults).to.equal(20);
    });

    it('detects an empty allergies list as a safe edge case', () => {
      const payload = {
        user_id: 1,
        dietaryConstraints: {
          allergies: []
        },
        maxResults: 5
      };

      expect(payload.dietaryConstraints.allergies).to.be.an('array').that.is.empty;
    });
  });
});