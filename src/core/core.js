import Observable from './observable';
import ObservableArray from './observable-array';
import LocalStorage from './local-storage';
import Utility from './utility';
import SkipList from './skip-list';
import Moment from 'moment';
import Slang from 'slang';

var Core = {
  Observable: Observable,
  ObservableArray: ObservableArray,
  LocalStorage: LocalStorage,
  Utility: Utility,
  SkipList: SkipList,
  moment: Moment,
  Slang: Slang
};

export default Core;
