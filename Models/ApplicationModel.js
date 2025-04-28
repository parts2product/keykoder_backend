const { DataTypes } = require("sequelize");
const sequelize = require("../db/db");
const User = require("./User");

const Application = sequelize.define("Application", {
  jobTitle: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false },
  skills: { type: DataTypes.JSON, allowNull: false },
  resume: { type: DataTypes.STRING, allowNull: false },
  education: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING, allowNull: false },
  address: { type: DataTypes.STRING, allowNull: false },
});

User.hasMany(Application, { foreignKey: "userID" });
Application.belongsTo(User, { foreignKey: "userID" });

module.exports = Application;
