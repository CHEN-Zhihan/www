all:
	-sudo pkill mongo
	mongod --dbpath ./data &
	npm start
