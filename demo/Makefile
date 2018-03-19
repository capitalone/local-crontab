all: dist/index.html dist/index.js dist/selectr.min.css
dist/index.html: src/index.html
	mkdir -p dist
	cp $^ $@
dist/index.js: src/index.js node_modules
	mkdir -p dist
	browserify $< -o $@
dist/selectr.min.css: node_modules/mobius1-selectr/dist/selectr.min.css
	mkdir -p dist
	cp $^ $@
dist/choices/choices.min.css: node_modules/choices.js/assets/styles/css/choices.min.css
	mkdir -p dist/choices
	cp $^ $@
node_modules: package.json
	npm i

clean:
	rm -rf dist
.PHONY: clean
