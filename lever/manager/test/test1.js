describe('Page Loads', function() {
	it('Should have a title', function() {
		browser.get('http://localhost:9000/stc/html/manager.html');
		expect(browser.getTitle()).toEqual('Diameter Manager Application');
	});
});

describe('Basic diameter configuration', function() {
	it('Listening port', function() {
		browser.get('http://localhost:9000/stc/html/manager.html#/configBasic');
		
		expect(element(by.model('diameterConfig.originRealm')).getAttribute('value')).toBe('fakerealm');
	});
});