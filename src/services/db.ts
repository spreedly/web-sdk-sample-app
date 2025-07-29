import sqlite from 'sqlite3';
import config from '../config';

export const db = new sqlite.Database(config.dbSource, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Database opened successfully');
    db.run(`CREATE TABLE api_keys (apiKey TEXT NOT NULL PRIMARY KEY, expiryIndays INTEGER NOT NULL);`,
      (err) => {
        if (err) {
          // Table already created
          console.log('Table already exists');
        } else {
          console.log('Table created successfully');
        }
      });
  }
});
