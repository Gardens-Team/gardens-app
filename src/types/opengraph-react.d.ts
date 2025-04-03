declare module 'opengraph-react' {
    interface OpengraphReactProps {
      site: string;
      appId: string;
      component?: 'large' | 'small' | 'x' | 'facebook' | 'linkedin';
      dontMakeCall?: boolean;
      results?: any;
      loader?: React.ReactNode;
      onlyFetch?: boolean;
      acceptLang?: string;
      disableAutoProxy?: boolean;
      fullRender?: boolean;
      useProxy?: boolean;
      usePremium?: boolean;
      useSuperior?: boolean;
      forceCacheUpdate?: boolean;
      dontUseVideo?: boolean;
      dontUseProduct?: boolean;
      debug?: boolean;
    }
  
    const OpengraphReactComponent: React.FC<OpengraphReactProps>;
    export default OpengraphReactComponent;
  }