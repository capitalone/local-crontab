all: bundle.js selectr.min.css
bundle.js: index.js node_modules
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
