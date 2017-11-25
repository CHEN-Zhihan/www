all:
	mongod --dbpath ./data &
	npm start
