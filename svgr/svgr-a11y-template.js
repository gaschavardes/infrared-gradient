function defaultTemplate(
	{
		imports,
		interfaces,
		componentName,
		jsx,
	},
	{ tpl }
) {
	return tpl`${imports}
import SvgRWrapper from 'app/Component/Layout/Utils/SvgRWrapper';
${interfaces}

export default function ${componentName}(props) {
	return <SvgRWrapper {...props}>{${jsx}}</SvgRWrapper>;
}`
}
module.exports = defaultTemplate
