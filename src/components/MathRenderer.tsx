import React from 'react';
import katex from 'katex';

interface MathRendererProps {
  content: string;
  className?: string;
  isBlock?: boolean;
}

export const MathRenderer: React.FC<MathRendererProps> = ({
  content,
  className = '',
  isBlock = false,
}) => {
  if (!content) return null;

  // دالة تحويل أجزاء الـ LaTeX إلى HTML من خلال KaTeX
  const renderMathAndText = (text: string) => {
    // التعبير النمطي لفصل $$ (كتلة) و $ (مضمن)
    // نراعي عدم مطابقة علامات الدولار العادية
    const regex = /(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g;
    const parts = text.split(regex);

    return parts.map((part, index) => {
      if (part.startsWith('$$') && part.endsWith('$$')) {
        const math = part.slice(2, -2).trim();
        try {
          const html = katex.renderToString(math, {
            displayMode: true,
            throwOnError: false,
            strict: false,
          });
          return (
            <span
              key={index}
              className="block my-2 text-center text-primary overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch (e) {
          return <span key={index} className="text-red-500">{part}</span>;
        }
      } else if (part.startsWith('$') && part.endsWith('$')) {
        const math = part.slice(1, -1).trim();
        try {
          const html = katex.renderToString(math, {
            displayMode: false,
            throwOnError: false,
            strict: false,
          });
          return (
            <span
              key={index}
              className="inline-block px-1 align-baseline font-mono text-amber-600 dark:text-amber-400 font-semibold"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch (e) {
          return <span key={index} className="text-red-500">{part}</span>;
        }
      } else {
        // نص عادي: معالجة السطور والخط العريض بسيطاً
        return (
          <span key={index}>
            {part.split('\n').map((line, lineIdx) => {
              // معالجة النصوص بين النجوم **نص عريض**
              const boldParts = line.split(/(\*\*.*?\*\*)/g);
              return (
                <React.Fragment key={lineIdx}>
                  {lineIdx > 0 && <br />}
                  {boldParts.map((bPart, bIdx) => {
                    if (bPart.startsWith('**') && bPart.endsWith('**')) {
                      return (
                        <strong key={bIdx} className="font-bold text-slate-900 dark:text-white">
                          {bPart.slice(2, -2)}
                        </strong>
                      );
                    }
                    return bPart;
                  })}
                </React.Fragment>
              );
            })}
          </span>
        );
      }
    });
  };

  return (
    <div className={`math-content leading-relaxed select-text ${className} ${isBlock ? 'my-2' : ''}`}>
      {renderMathAndText(content)}
    </div>
  );
};
