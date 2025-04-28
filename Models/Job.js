const { DataTypes } = require("sequelize");
const sequelize = require("../db/db");

const Job = sequelize.define("Job", {
  fullName: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  skills: { type: DataTypes.JSON, allowNull: false },
  uploadResume: { type: DataTypes.STRING, allowNull: false },
}, {
  timestamps: true,
});

module.exports = Job;
