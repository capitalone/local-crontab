all: index.html index.js selectr.min.css
index.html: src/index.html
	mkdir -p dist
	cp $^ $@
index.js: src/index.js node_modules
	mkdir -p dist
	browserify $< -o $@
selectr.min.css: node_modules/mobius1-selectr/dist/selectr.min.css
	mkdir -p dist
	cp $^ $@
node_modules: package.json
	npm i

clean:
	rm -rf dist
.PHONY: clean
