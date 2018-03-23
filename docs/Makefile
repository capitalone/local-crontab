all: bundle.js selectr.min.css
bundle.js: index.js node_modules
	npx browserify $< -o $@
selectr.min.css: node_modules/mobius1-selectr/dist/selectr.min.css
	cp $^ $@
node_modules: package.json
	npm i

clean:
	rm -rf bundle.js node_modules
.PHONY: clean
